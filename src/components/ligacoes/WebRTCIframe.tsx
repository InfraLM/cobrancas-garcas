interface WebRTCIframeProps {
  url: string | null;
  sipRegistrado: boolean;
}

/**
 * Iframe do WebRTC da 3C Plus.
 * Montado no AppLayout para persistir entre navegações.
 *
 * IMPORTANTE: O iframe precisa de dimensões reais para que o navegador
 * aloque recursos suficientes para o WebRTC registrar SIP.
 * Fica visível (220x220) durante o registro SIP, depois minimiza.
 */
export default function WebRTCIframe({ url, sipRegistrado }: WebRTCIframeProps) {
  if (!url) return null;

  return (
    <iframe
      id="webrtc-3cplus"
      src={url}
      allow="microphone; autoplay; camera; display-capture"
      title="3C Plus WebRTC"
      className={`fixed z-[9999] border transition-all duration-500 ${
        sipRegistrado
          ? 'bottom-0 right-0 w-px h-px opacity-0 pointer-events-none border-transparent'
          : 'bottom-4 right-4 w-[220px] h-[220px] rounded-xl border-gray-200 shadow-lg'
      }`}
    />
  );
}
