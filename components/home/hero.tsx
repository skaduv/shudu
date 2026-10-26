"use client";
import { Glass } from "@/components/ui/glass";
import { useFx } from "@/components/app/fx";

const DIGITS = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** 首页头图：真正的 lore-glass 折射引擎，一片玻璃镜片在数字矩阵上缓缓漂移 */
export function Hero() {
  const fx = useFx();
  const content = (
    <div className="absolute inset-0 overflow-hidden">
      <div className="num absolute inset-0 grid grid-cols-[repeat(27,1fr)] place-items-center text-[18px] font-semibold text-[#3b4a8a]/25 dark:text-white/20">
        {(DIGITS + DIGITS.slice(0, 27)).split("").map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <h1 className="bg-gradient-to-br from-[#2f5bff] via-[#8b5cf6] to-[#ff5c8a] bg-clip-text text-[clamp(40px,9vw,72px)] font-bold leading-none tracking-tight text-transparent">
          液态数独
        </h1>
        <p className="mt-3 text-[clamp(13px,2.4vw,16px)] text-[var(--ink-soft)]">无需登录，点开就玩，进度自动保存</p>
      </div>
    </div>
  );
  return (
    <div className="relative h-[200px] overflow-hidden rounded-[28px] sm:h-[230px]">
      {fx === "full" ? (
        <Glass
          className="absolute inset-0"
          chroma={0}
          depth={18}
          domeDepth={16}
          edgeHighlight={0.35}
          glow={0.1}
          scaleX={0.035}
          scaleY={0.035}
          lens={
            <div
              data-glass-lens
              className="float-lens"
              style={{
                position: "absolute",
                left: "6%",
                top: "calc(50% - 55px)",
                width: 150,
                height: 110,
                borderRadius: 36,
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.7), 0 14px 34px -10px rgba(60,40,140,0.45)",
              }}
            />
          }
        >
          <div className="absolute inset-0 bg-[linear-gradient(120deg,#eaf0ff_0%,#f6ecff_50%,#ffeef3_100%)] dark:bg-[linear-gradient(120deg,#151a36_0%,#221640_50%,#2a1630_100%)]" />
          {content}
        </Glass>
      ) : (
        <div className="absolute inset-0 bg-white/40 dark:bg-white/5">{content}</div>
      )}
    </div>
  );
}
