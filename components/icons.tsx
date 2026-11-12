type GlyphProps = {
  activeIndex?: number;
  activeCount?: number;
  active?: "hot" | "iced";
};

const inactive = "#7e8e87";

function strokeFor(on: boolean) {
  return on ? "currentColor" : inactive;
}

export function SizeIcons({ activeIndex = 1 }: GlyphProps) {
  const cups = [
    { x: 1, w: 9, h: 10 },
    { x: 16, w: 11, h: 14 },
    { x: 34, w: 13, h: 18 },
  ];
  return (
    <svg viewBox="0 0 50 22" className="h-10 w-auto" aria-hidden>
      {cups.map((cup, index) => {
        const on = index === activeIndex;
        const y = 20.5 - cup.h;
        const color = strokeFor(on);
        const width = on ? 1.85 : 1.4;
        return (
          <g key={cup.x} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round">
            <path d={`M ${cup.x + 0.4} ${y + 2.4} H ${cup.x + cup.w - 0.4}`} />
            <path d={`M ${cup.x + 1} ${y + 2.3} Q ${cup.x + cup.w / 2} ${y - 0.6} ${cup.x + cup.w - 1} ${y + 2.3}`} />
            <path d={`M ${cup.x + 0.7} ${y + 2.5} L ${cup.x + 1.7} ${y + cup.h} H ${cup.x + cup.w - 1.7} L ${cup.x + cup.w - 0.7} ${y + 2.5}`} />
          </g>
        );
      })}
    </svg>
  );
}

export function ShotIcons({ activeCount = 2 }: GlyphProps) {
  return (
    <svg viewBox="0 0 50 22" className="h-10 w-auto" aria-hidden>
      {[0, 1, 2].map((index) => {
        const on = index < activeCount;
        const x = 2 + index * 16;
        const color = strokeFor(on);
        const width = on ? 1.85 : 1.4;
        return (
          <g key={index} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round">
            <path d={`M ${x} 4 H ${x + 10} L ${x + 8.7} 18.5 H ${x + 1.3} Z`} />
            <path d={`M ${x + 0.4} 7.2 H ${x + 9.6}`} />
          </g>
        );
      })}
    </svg>
  );
}

export function MilkIcons({ activeIndex = 0 }: GlyphProps) {
  return (
    <svg viewBox="0 0 62 22" className="h-10 w-auto" aria-hidden>
      <Cow x={0} on={activeIndex === 0} />
      <Wheat x={22} on={activeIndex === 1} />
      <Almond x={44} on={activeIndex === 2} />
    </svg>
  );
}

function Cow({ x, on }: { x: number; on: boolean }) {
  const color = strokeFor(on);
  const width = on ? 1.7 : 1.35;
  return (
    <g transform={`translate(${x} 0)`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.2 7.2 C5.2 3.8 3.2 3.2 3 5" />
      <path d="M13.8 7.2 C14.8 3.8 16.8 3.2 17 5" />
      <path d="M4.2 9.2 C2.4 8.6 1.8 11.4 3.6 12.4" />
      <path d="M15.8 9.2 C17.6 8.6 18.2 11.4 16.4 12.4" />
      <ellipse cx="10" cy="12.2" rx="5.3" ry="5.1" />
      <circle cx="8" cy="11.6" r="0.55" fill={color} stroke="none" />
      <circle cx="12" cy="11.6" r="0.55" fill={color} stroke="none" />
      <ellipse cx="10" cy="14.6" rx="1.9" ry="1.25" />
      <path d="M9.2 14.6 H10.8" />
    </g>
  );
}

function Wheat({ x, on }: { x: number; on: boolean }) {
  const color = strokeFor(on);
  const width = on ? 1.7 : 1.35;
  return (
    <g transform={`translate(${x} 1)`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19 V6" />
      <path d="M9 8 C7 6.6 6.2 5 7.2 3.6" />
      <path d="M9 10.2 C7.1 9.2 5.8 8.2 5.6 6.6" />
      <path d="M9 12.6 C7.2 11.8 6 11 5.8 9.4" />
      <path d="M9 15 C7.4 14.4 6.4 13.8 6.3 12.4" />
      <path d="M9 8 C11 6.6 11.8 5 10.8 3.6" />
      <path d="M9 10.2 C10.9 9.2 12.2 8.2 12.4 6.6" />
      <path d="M9 12.6 C10.8 11.8 12 11 12.2 9.4" />
      <path d="M9 15 C10.6 14.4 11.6 13.8 11.7 12.4" />
    </g>
  );
}

function Almond({ x, on }: { x: number; on: boolean }) {
  const color = strokeFor(on);
  const width = on ? 1.7 : 1.35;
  return (
    <g transform={`translate(${x} 1)`} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round">
      <path d="M9 2.4 C13.2 6.2 14 12 9 18.4 C4 12 4.8 6.2 9 2.4 Z" />
      <path d="M9 5.2 V16" strokeLinecap="round" />
    </g>
  );
}

export function TempIcons({ active = "hot" }: GlyphProps) {
  const hot = active === "hot";
  const iced = active === "iced";
  return (
    <svg viewBox="0 0 52 22" className="h-10 w-auto" aria-hidden>
      <g fill="none" stroke={strokeFor(hot)} strokeWidth={hot ? 1.7 : 1.35} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5 H13.5 V16.2 Q13.5 19 10.6 19 H6.8 Q4 19 4 16.2 Z" />
        <path d="M13.5 11.2 H15.4 Q17.6 11.2 17.6 13.5 Q17.6 15.8 15.4 15.8 H13.5" />
        <path d="M6.2 6.6 Q7.2 5.2 6.2 3.8" />
        <path d="M8.8 6.8 Q9.8 5 8.8 3.2" />
        <path d="M11.4 6.6 Q12.4 5.2 11.4 3.8" />
      </g>
      <g fill="none" stroke={strokeFor(iced)} strokeWidth={iced ? 1.7 : 1.35} strokeLinejoin="round">
        <rect x="24" y="6.5" width="9" height="9" rx="1.5" transform="rotate(-16 28.5 11)" />
        <rect x="32.5" y="7.2" width="9" height="9" rx="1.5" transform="rotate(14 37 11.7)" />
      </g>
    </svg>
  );
}
