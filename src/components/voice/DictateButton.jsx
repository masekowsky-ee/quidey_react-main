// Dictating into a text (the notes editor): keeps listening through pauses and puts each finished
// sentence in once, at the cursor (insert(text)); words still being recognised wait until they're final.

import { useRef } from 'react';
import MicButton from './MicButton.jsx';

export default function DictateButton({ insert, className }) {
    // how much of this dictation's text is already in
    const done = useRef(0);
    return (
        <MicButton className={className} continuous
            onListening={(on) => { if (on) done.current = 0; }}
            onText={(text, final) => {
                if (!final || text.length <= done.current) return;
                const next = text.slice(done.current);
                done.current = text.length;
                insert(next);
            }} />
    );
}
