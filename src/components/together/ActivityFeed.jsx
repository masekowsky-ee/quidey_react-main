import { useTranslation } from '../../i18n/useTranslation';
import { describeEvent } from '../../features/together/format';
import { postSharedMessage } from '../../features/together/togetherAction';
import { useTogetherRun } from '../../features/together/hooks';
import ChatPanel, { ChatEvent } from './ChatPanel';

// What happened in the session and the chat, newest at the bottom
export default function ActivityFeed({ session, tall = false }) {
    const { t } = useTranslation();
    const run = useTogetherRun();
    const items = session.events.map(event => (event.type === 'message' ? { ...event, mine: event.user?.id === session.me } : event));
    return (
        <ChatPanel
            items={items} tall={tall} canSend={!session.endedAt}
            title={t('activity')} emptyText={t('noActivity')} placeholder={t('messagePlaceholder')} maxLength={1000}
            onSend={(message) => run(postSharedMessage(session.id, message))}
            renderItem={(event, time) => <ChatEvent type={event.type} text={describeEvent(t, event)} createdAt={event.createdAt} time={time} />}
        />
    );
}
