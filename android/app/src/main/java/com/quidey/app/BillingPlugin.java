package com.quidey.app;

import android.content.Intent;
import android.net.Uri;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Quidey Pro in the app through Google Play Billing (features/pro/pro.js). The subscription
 * product (quidey_pro) has the base plans "monthly" and "yearly"; Google Play shows the prices in
 * the person's currency. The purchase token goes to the server, which checks and acknowledges it
 * with Google (backend utils/billing.js), so nothing is unlocked here on the phone alone.
 *
 * getPlans({ productId }) -> { plans: [{ basePlanId, price, priceMicros, currency, offerToken }] }
 * purchase({ productId, offerToken, accountId }) -> { purchaseToken } | {} (closed) | { pending: true }
 * restore({ productId }) -> { purchases: [{ purchaseToken }] }
 * manage({ productId }): Google Play's page of my subscriptions
 */
@CapacitorPlugin(name = "QuideyBilling")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private PluginCall purchaseCall;
    private String purchaseProduct;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    }

    /** Runs `ready` once connected to Google Play; rejects the call when Play isn't there. */
    private void connected(PluginCall call, Runnable ready) {
        if (client.isReady()) {
            ready.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else call.reject("Google Play Billing unavailable: " + result.getDebugMessage(), "UNAVAILABLE");
            }

            @Override
            public void onBillingServiceDisconnected() {
                // connected again on the next call
            }
        });
    }

    @PluginMethod
    public void getPlans(PluginCall call) {
        String productId = call.getString("productId", "quidey_pro");
        connected(call, () -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()))
                .build();
            client.queryProductDetailsAsync(params, (result, details) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(result.getDebugMessage(), "FAILED");
                    return;
                }
                JSArray plans = new JSArray();
                for (ProductDetails product : details.getProductDetailsList()) {
                    products.put(product.getProductId(), product);
                    List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
                    if (offers == null) continue;
                    for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                        // the base plans themselves, not promotional offers on top of them
                        if (offer.getOfferId() != null) continue;
                        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                        if (phases.isEmpty()) continue;
                        ProductDetails.PricingPhase price = phases.get(phases.size() - 1);
                        JSObject plan = new JSObject();
                        plan.put("basePlanId", offer.getBasePlanId());
                        plan.put("price", price.getFormattedPrice());
                        plan.put("priceMicros", price.getPriceAmountMicros());
                        plan.put("currency", price.getPriceCurrencyCode());
                        plan.put("offerToken", offer.getOfferToken());
                        plans.put(plan);
                    }
                }
                JSObject answer = new JSObject();
                answer.put("plans", plans);
                call.resolve(answer);
            });
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "quidey_pro");
        String offerToken = call.getString("offerToken");
        String accountId = call.getString("accountId");
        ProductDetails product = products.get(productId);
        if (product == null || offerToken == null) {
            call.reject("Load the plans first", "INVALID");
            return;
        }
        connected(call, () -> {
            BillingFlowParams.Builder flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product)
                        .setOfferToken(offerToken)
                        .build()));
            // binds the purchase to the Quidey account (a hash of its id, see the backend)
            if (accountId != null && !accountId.isEmpty()) flow.setObfuscatedAccountId(accountId);
            call.setKeepAlive(true);
            purchaseCall = call;
            purchaseProduct = productId;
            BillingResult result = client.launchBillingFlow(getActivity(), flow.build());
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                finishPurchase(null, result);
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        Purchase bought = null;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                if (purchaseProduct == null || purchase.getProducts().contains(purchaseProduct)) bought = purchase;
            }
        }
        finishPurchase(bought, result);
    }

    private void finishPurchase(Purchase purchase, BillingResult result) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        purchaseProduct = null;
        if (call == null) return;
        call.setKeepAlive(false);
        JSObject answer = new JSObject();
        int code = result.getResponseCode();
        if (purchase != null && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            answer.put("purchaseToken", purchase.getPurchaseToken());
            call.resolve(answer);
        } else if (purchase != null && purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            answer.put("pending", true);
            call.resolve(answer);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED || code == BillingClient.BillingResponseCode.OK) {
            call.resolve(answer);
        } else {
            call.reject(result.getDebugMessage(), "FAILED");
        }
    }

    @PluginMethod
    public void restore(PluginCall call) {
        String productId = call.getString("productId", "quidey_pro");
        connected(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                JSArray list = new JSArray();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Purchase purchase : purchases) {
                        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        if (!purchase.getProducts().contains(productId)) continue;
                        JSObject item = new JSObject();
                        item.put("purchaseToken", purchase.getPurchaseToken());
                        list.put(item);
                    }
                }
                JSObject answer = new JSObject();
                answer.put("purchases", list);
                call.resolve(answer);
            }));
    }

    @PluginMethod
    public void manage(PluginCall call) {
        String productId = call.getString("productId", "quidey_pro");
        Uri uri = Uri.parse("https://play.google.com/store/account/subscriptions?sku=" + productId + "&package=" + getContext().getPackageName());
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
