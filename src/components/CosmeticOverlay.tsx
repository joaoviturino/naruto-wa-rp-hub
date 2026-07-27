import { useCharacterCosmetics } from "@/hooks/useCharacterCosmetics";

/**
 * Renderiza as peças cosméticas equipadas do personagem sobrepostas ao sprite base.
 * Deve ser colocado como filho de um container `relative`. As camadas seguem o tamanho
 * do container e usam `object-contain` para acompanhar a proporção do sprite.
 */
export function CosmeticOverlay({
  characterId,
  flipX = false,
  className = "",
}: {
  characterId: string | null | undefined;
  flipX?: boolean;
  className?: string;
}) {
  const pieces = useCharacterCosmetics(characterId);
  if (!characterId || pieces.length === 0) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {pieces.map((p, i) => (
        <img
          key={`${p.slot}-${i}`}
          src={p.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={{ zIndex: 10 + p.z_index, transform: flipX ? "scaleX(-1)" : undefined }}
          draggable={false}
        />
      ))}
    </div>
  );
}