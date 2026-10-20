import { Player } from '@remotion/player';
import FocusLoop, { LOOP_FPS, LOOP_FRAMES, LOOP_HEIGHT, LOOP_WIDTH } from './FocusLoop';

// The headline's slot, played in a loop. Still (the finished logo) when motion is off.
export default function FocusLoopPlayer({ still, doneLabel }) {
    return (
        <Player
            component={FocusLoop}
            inputProps={{ doneLabel }}
            durationInFrames={LOOP_FRAMES}
            fps={LOOP_FPS}
            compositionWidth={LOOP_WIDTH}
            compositionHeight={LOOP_HEIGHT}
            style={{ width: '100%', height: '100%' }}
            autoPlay={!still}
            loop
            initialFrame={still ? 200 : 0}
            initiallyMuted
            numberOfSharedAudioTags={0}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
        />
    );
}
