import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNoteBoards, pinToBoard, unpinFromBoard, pinnableBoards, boardErrorText } from '../../features/board/board';
import { selectFamilies } from '../../features/family/family';
import { showToast } from '../../features/toast/toast';
import { fill } from '../../features/helperFunction';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../icons.jsx';
import styles from './PinToBoards.module.css';

const boardKey = (kind, id) => `${kind}-${id}`;

// In a note of mine: "An Board heften", the boards of my families and open sessions as switches
// (on: pinned there). Hidden while I'm in none.
export default function PinToBoards({ noteId }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const families = useSelector(selectFamilies);
    const sessions = useSelector(state => state.together.sessions);
    const boards = pinnableBoards(families, sessions);
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(null); // Map key -> pinId
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        let gone = false;
        fetchNoteBoards(noteId)
            .then(list => { if (!gone) setPinned(new Map((Array.isArray(list) ? list : []).map(item => [boardKey(item.kind, item.id), item.pinId]))); })
            .catch(() => { if (!gone) setPinned(new Map()); });
        return () => { gone = true; };
    }, [noteId]);

    if (boards.length === 0) return null;
    const count = pinned ? boards.filter(board => pinned.has(boardKey(board.kind, board.id))).length : 0;

    const toggle = async (board) => {
        const key = boardKey(board.kind, board.id);
        setBusy(key);
        try {
            if (pinned.has(key)) {
                await unpinFromBoard(board.kind, board.id, pinned.get(key));
                setPinned(prev => { const next = new Map(prev); next.delete(key); return next; });
            } else {
                const pin = await pinToBoard(board.kind, board.id, noteId);
                setPinned(prev => new Map(prev).set(key, pin.id));
                dispatch(showToast(fill(t('noteBoardPinnedTo'), { name: board.name }), 'success'));
            }
        } catch (err) {
            dispatch(showToast(boardErrorText(t, err), 'error'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className={styles.wrap}>
            <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(v => !v)}>
                <Icon name="pin" size={15} />
                {count > 0 ? fill(t(count === 1 ? 'noteBoardOnOne' : 'noteBoardOnMany'), { n: count }) : t('noteBoardPinToBoard')}
                <Icon name="chevronDown" size={14} />
            </button>
            {open &&
                <div className={styles.panel}>
                    <p className={styles.hint}>{t('noteBoardPinToHint')}</p>
                    <ul className={styles.list}>
                        {boards.map(board => {
                            const key = boardKey(board.kind, board.id);
                            const on = pinned?.has(key) ?? false;
                            return (
                                <li key={key}>
                                    <button type="button" className={styles.board} aria-pressed={on} disabled={pinned === null || busy === key} onClick={() => toggle(board)}>
                                        <span aria-hidden="true" className={styles.mark}>
                                            {board.emoji ?? <Icon name={board.kind === 'family' ? 'family' : 'together'} size={15} />}
                                        </span>
                                        <span className={styles.name}>{board.name}</span>
                                        <span className={styles.kind}>{t(board.kind === 'family' ? 'noteBoardKindFamily' : 'noteBoardKindSession')}</span>
                                        <span className={styles.state}>{on ? <><Icon name="check" size={13} /> {t('noteBoardIsPinned')}</> : t('noteBoardPin')}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>}
        </div>
    );
}
