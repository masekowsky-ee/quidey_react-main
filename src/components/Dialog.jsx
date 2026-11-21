import { createPortal } from 'react-dom';
import { useSheet } from '../features/layout/dragDismiss';
import { useModal } from '../features/layout/useModal';
import SheetGrabber from './SheetGrabber.jsx';

// A dialog in the page's one way: portal to <body>, a sheet (useSheet: from the bottom on phones,
// pulled down to put away), a click that starts on the backdrop itself closes it, Escape, focus
// in and back (useModal), role / aria-modal / aria-labelledby.
//   onClose        called once it is put away (cross, Escape, a click beside it, a pull down)
//   labelledBy     id of its title; describedBy: id of its text
//   role           'dialog' (default) or 'alertdialog'
//   initialFocus   what gets the focus on open: a ref, or a function returning the element (called once it is mounted)
//   backdropClassName / className   the dimmed layer and the card (ui.module.css dialogBackdrop /
//                  dialogCard are the shared look)
//   drag           the whole card takes the sheet drag (a card without a head of its own)
//   nested         see useModal
//   sheet={false}  no sheet motion or gestures (a plain dialog)
//   portal={false} stays where it is rendered
//   panel={false}  no card element: children(dismiss, sheet) renders its own and spreads sheet.panel
//   panelRef / panelProps  for the card (a ref the caller needs, extra attributes)
// children: nodes, or (dismiss, sheet) => nodes; dismiss(then?) puts it away, then calls `then`
// (default onClose).
export default function Dialog({
    onClose, labelledBy, describedBy, role = 'dialog', initialFocus, backdropClassName, className,
    drag = false, nested = false, sheet: asSheet = true, portal = true, panel = true, panelRef, panelProps, children,
}) {
    const sheet = useSheet(onClose, panelRef);
    const { dismiss } = sheet;
    useModal(dismiss, { initialFocus, nested });

    const content = typeof children === 'function' ? children(dismiss, sheet) : children;
    const card = panel
        ? (
            <div className={className} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}
                {...(asSheet ? sheet.panel : {})} data-sheet-drag={drag ? '' : undefined} {...panelProps}>
                {asSheet && <SheetGrabber />}
                {content}
            </div>
        )
        : content;
    const layer = (
        <div className={backdropClassName} {...(asSheet ? sheet.backdrop : {})}
            onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
            {card}
        </div>
    );
    return portal ? createPortal(layer, document.body) : layer;
}
