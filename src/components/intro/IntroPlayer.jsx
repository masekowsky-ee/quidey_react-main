import { useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import LogoIntro, { INTRO_FPS, INTRO_FRAMES } from './LogoIntro';
import ExtremeIntro, { EXTREME_FRAMES } from './ExtremeIntro';

// Plays the logo composition once (the big one on "extreme") and reports when it is over
export default function IntroPlayer({ extreme, onEnded }) {
    const ref = useRef(null);

    useEffect(() => {
        const player = ref.current;
        if (!player) return;
        player.addEventListener('ended', onEnded);
        return () => player.removeEventListener('ended', onEnded);
    }, [onEnded]);

    return (
        <Player
            ref={ref}
            component={extreme ? ExtremeIntro : LogoIntro}
            durationInFrames={extreme ? EXTREME_FRAMES : INTRO_FRAMES}
            fps={INTRO_FPS}
            compositionWidth={extreme ? 1280 : 640}
            compositionHeight={extreme ? 720 : 360}
            style={extreme ? { width: '100vw', height: '100vh' } : { width: 'min(640px, 100vw)', aspectRatio: '16 / 9' }}
            // silent, so browsers let it start on their own
            autoPlay
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
