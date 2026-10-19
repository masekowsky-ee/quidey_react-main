import { useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import LogoIntro, { INTRO_FPS, INTRO_FRAMES } from './LogoIntro';

// Plays the logo composition once and reports when it is over
export default function IntroPlayer({ onEnded }) {
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
            component={LogoIntro}
            durationInFrames={INTRO_FRAMES}
            fps={INTRO_FPS}
            compositionWidth={640}
            compositionHeight={360}
            style={{ width: 'min(640px, 100vw)', aspectRatio: '16 / 9' }}
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
