import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Briefcase, Clover, Gamepad2, Gift, KeyRound, Link2, Store, TrendingUp } from "lucide-react";
import { ClanWarHero } from "@/components/petfarm/clan-war-hero";
import { PetRow } from "@/components/petfarm/wiki/pet-gallery";
import { Reveal } from "@/components/petfarm/reveal";
import { cn } from "@/lib/utils";
import { PLAY_DESCRIPTION, SITE_ORIGIN, WIKI_ORIGIN, playUrl } from "@/lib/petdex-public";
import { INDUSTRY_COUNT, LAND_RULES, SPECIES_COUNT, legendaryPets } from "@/lib/wiki/game-data";
import { CLAN, UNLOCKS } from "@/lib/wiki/rules";
import * as gear from "@/public/ta-tua/game/js/shared/gear.js";
import { CLAN_LEVELS, clanPerks } from "@/public/ta-tua/game/js/shared/clan.js";
import { LEVEL_FORMS } from "@/public/ta-tua/game/js/shared/pets.js";
import "../petfarm-fonts.css";

// The Petfarm website (petfarm.online, rewritten to /petfarm by middleware.ts): one page about the
// game, at night. The hero is a clan war drawn live by the game's own renderer; every other picture
// is a real screenshot of the game (public/petfarm). Every number on the page is read from the
// game's rules, so the page cannot drift from the game.
// Palette: off-black with one gold accent. Shapes: 10px everywhere, chips full round.

const TITLE = "Petfarm · Chiến gia tộc ở Phố Trân Châu";
const DESCRIPTION = "Game nuôi thú cưng nhiều người chơi trên trình duyệt: nuôi bé, đi làm, lập gia tộc, mua đất và tranh ngôi trùm Phố Trân Châu.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: "Petfarm",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Petfarm", title: TITLE, description: DESCRIPTION, locale: "vi_VN", url: "/", images: [{ url: "/petfarm/og.jpg", width: 1200, height: 630, alt: "Phố Trân Châu trong game Petfarm" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/petfarm/og.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0b0a0f", colorScheme: "dark" };

type Tier = "blue" | "green" | "gold" | "red";
type Affix = "income" | "stats" | "trade" | "luck";
const TIERS = gear.TIERS as Record<Tier, { name: string; color: string; lines: number }>;
const TIER_ORDER = gear.TIER_ORDER as Tier[];
const CONFIG = gear.DEFAULT_GEAR_CONFIG as { odds: Record<Tier, number>; ranges: Record<Tier, Record<Affix, number[]>> };
/** Đồ mua ở cửa hàng là hộp kín chỉ ra Xanh lam (1 dòng) hoặc Xanh lục (2 dòng); cấp cao chỉ có ở nguồn khác. */
const SHOP_TIERS: readonly string[] = gear.SHOP_TIERS;
const shopShare = (t: Tier) => Math.round((CONFIG.odds[t] / SHOP_TIERS.reduce((s, x) => s + CONFIG.odds[x as Tier], 0)) * 100);
const AFFIX_COPY: { key: Affix; icon: typeof Briefcase; name: string; text: string }[] = [
  { key: "income", icon: Briefcase, name: "Thu nhập ca làm", text: "Lương mỗi ca làm nghề nhiều hơn." },
  { key: "stats", icon: TrendingUp, name: "Chỉ số", text: "Kỹ năng lên nhanh, chăm sóc hồi nhiều hơn." },
  { key: "trade", icon: Store, name: "Thu nhập giao dịch", text: "Thưởng thêm mỗi lần bán ở chợ và trên Sàn." },
  { key: "luck", icon: Clover, name: "May mắn", text: "Dễ ra món ngon, dễ rớt đồ, dễ trúng cấp cao." },
];

const TOP_FORM = (LEVEL_FORMS as { from: number; name: string }[]).at(-1)!;
const xu = (n: number) => n.toLocaleString("vi-VN");
const TOP_CLAN = clanPerks(CLAN_LEVELS.length) as { maxMembers: number; maxPlots: number; maxIndustries: number; prodBonus: number };

/** The road from a new player to the top clan, with the game's own numbers. */
const CLAN_ROAD = [
  { title: "Lập gia tộc", text: `Có một bé đạt cấp ${CLAN.unlockLevel} là lập được, phí ${xu(CLAN.createCost)} xu. Chọn tên, huy hiệu và màu cờ.` },
  { title: "Mua đất", text: `Sở Nhà Đất có ${LAND_RULES.count} lô, giá từ ${xu(LAND_RULES.minPrice)} tới ${xu(LAND_RULES.maxPrice)} xu. Lô đẹp thì sản lượng cao.` },
  { title: "Thâu tóm ngành", text: `${INDUSTRY_COUNT} ngành từ trà, sữa tới nhà máy. Gia tộc mở ngành thứ hai ở cấp ${CLAN.industryLevels[1]}, thứ ba ở cấp ${CLAN.industryLevels[2]}.` },
  { title: "Lên ngôi", text: `Gia tộc cấp ${CLAN_LEVELS.length} có tới ${TOP_CLAN.maxMembers} thành viên, ${TOP_CLAN.maxPlots} lô đất và thêm ${Math.round(TOP_CLAN.prodBonus * 100)}% sản lượng.` },
];

const NUMBERS = [
  [String(LAND_RULES.count), "lô đất để tranh"],
  [String(INDUSTRY_COUNT), "ngành để thâu tóm"],
  [String(CLAN_LEVELS.length), "cấp gia tộc"],
  [String(SPECIES_COUNT), "loài bé ngũ hành"],
] as const;

const FAQ = [
  ["Chơi có mất phí không?", "Không. Vào trang chơi, tạo tài khoản bằng tên và mật khẩu là có 150 xu chào mừng để nhận nuôi bé đầu tiên."],
  ["Chơi trên điện thoại được không?", "Được. Game chạy ngay trên trình duyệt điện thoại và máy tính, không cần cài ứng dụng. Đăng nhập cùng tài khoản thì bé và xu đi theo bạn."],
  ["Khi nào vào được gia tộc?", `Khi có một bé đạt cấp ${CLAN.unlockLevel}. Lúc đó mở màn Gia tộc và Sở Nhà Đất trên bản đồ phố để lập gia tộc mới hoặc xin vào gia tộc có sẵn.`],
  ["Không vào game thì bé có sao không?", "Bé vẫn sống theo giờ thật: đói dần, buồn dần, có thể ốm nếu bị bỏ quên lâu. Ghé thăm mỗi ngày, cho ăn và tắm là bé khỏe."],
  ["Nuôi được mấy bé?", "Tối đa 4 bé cùng lúc. Bé đầu tiên miễn phí, bé sau tốn 200 xu. Loài hiếm chỉ nở từ trứng ngũ hành."],
  ["Mã quà nhập ở đâu?", "Trong game, bấm vào tên mình ở góc trên rồi chọn Nhập mã quà. Mỗi mã chỉ nhận được một lần."],
] as const;

const GOLD_BUTTON = cn(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[var(--pf-gold)] font-[family-name:var(--pf-display)] font-bold text-[#1a1306]",
  "shadow-[0_4px_0_#8a6212,0_10px_30px_-10px_rgba(242,193,78,0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_1px_0_#8a6212]",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pf-gold)]/40",
);

/** The one call to action, the same everywhere on the page. */
function PlayButton({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <a href={playUrl()} className={cn(GOLD_BUTTON, size === "lg" ? "h-14 px-7 text-xl" : "h-11 px-5 text-lg", className)}>
      Vào chơi <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
    </a>
  );
}

function Shot({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={cn("h-auto w-full rounded-[10px] border border-[var(--pf-line)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]", className)}
    />
  );
}

const H2 = "font-[family-name:var(--pf-display)] text-3xl font-extrabold leading-[1.08] tracking-tight text-[var(--pf-ink)] md:text-5xl";
const LEAD = "mt-4 max-w-[58ch] text-lg leading-relaxed text-[var(--pf-muted)]";
const PANEL = "rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)]";

export default function PetfarmSite() {
  return (
    <div
      className={cn(
        "pf-fonts",
        "min-h-dvh bg-[var(--pf-bg)] font-[family-name:var(--pf-body)] text-[var(--pf-ink)] antialiased [color-scheme:dark] selection:bg-[var(--pf-gold)] selection:text-[#1a1306]",
        // The site is always night: off-black zinc, one gold. --pf-* also feeds the shared pet row.
        "[--pf-bg:#0b0a0f] [--pf-glass:rgba(11,10,15,0.82)] [--pf-surface:#141219] [--pf-surface-2:#1c1922] [--pf-ink:#f4efe6] [--pf-muted:#a39d93] [--pf-line:#2a2631]",
        "[--pf-gold:#f2c14e] [--pf-accent:#f2c14e] [--pf-button-ink:#1a1306]",
      )}
    >
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-[var(--pf-surface)] focus:px-4 focus:py-2">
        Bỏ qua tới nội dung
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--pf-line)] bg-[var(--pf-glass)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6" aria-label="Chính">
          <a href="#" className="flex items-center gap-2 font-[family-name:var(--pf-display)] text-2xl font-extrabold text-[var(--pf-gold)]">
            <span aria-hidden>🧋</span> Petfarm
          </a>
          <div className="ml-auto hidden items-center gap-7 text-[15px] font-bold text-[var(--pf-muted)] md:flex">
            <a href="#gia-toc" className="hover:text-[var(--pf-ink)]">Gia tộc</a>
            <a href="#cach-choi" className="hover:text-[var(--pf-ink)]">Cách chơi</a>
            <a href="#trang-phuc" className="hover:text-[var(--pf-ink)]">Trang phục</a>
            <a href="#hoi-dap" className="hover:text-[var(--pf-ink)]">Hỏi đáp</a>
            <a href={WIKI_ORIGIN} className="hover:text-[var(--pf-ink)]">Wiki</a>
          </div>
          <PlayButton className="ml-auto h-10 px-4 text-base md:ml-0" />
        </nav>
      </header>

      <main id="noi-dung">
        {/* Hero: words on the left, the clan war on the right */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_40%,rgba(242,193,78,0.10),transparent_70%)]" />
          <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:py-16">
            <div>
              <p className="font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.16em] text-[var(--pf-gold)]">{PLAY_DESCRIPTION}</p>
              <h1 className="mt-4 font-[family-name:var(--pf-display)] text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[3.6rem] xl:text-[4.25rem]">
                Chiến gia tộc.
                <span className="block text-[var(--pf-gold)]">Ai làm trùm phố?</span>
              </h1>
              <p className="mt-6 max-w-[40ch] text-lg leading-relaxed text-[var(--pf-muted)]">
                Nuôi bé, lập gia tộc, mua đất, thâu tóm ngành và đưa bé chiến của bạn lên bục vàng.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PlayButton size="lg" />
                <a
                  href="#gia-toc"
                  className="inline-flex h-14 items-center gap-2 rounded-[10px] border border-[var(--pf-line)] px-5 font-[family-name:var(--pf-display)] text-lg font-bold text-[var(--pf-ink)] transition-colors hover:border-[var(--pf-gold)] active:translate-y-[1px]"
                >
                  Xem luật chơi
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] border border-[var(--pf-gold)]/40 shadow-[0_40px_120px_-40px_rgba(242,193,78,0.35),0_30px_60px_-20px_rgba(0,0,0,0.9)]">
                <ClanWarHero />
              </div>
              <div aria-hidden className="mt-4 flex items-center justify-between font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.14em] sm:text-base">
                <span className="text-[#ff8a7a]">Gia tộc Hỏa</span>
                <span className="text-[var(--pf-gold)]">VS</span>
                <span className="text-[#8fb4ff]">Gia tộc Thủy</span>
              </div>
            </div>
          </div>
        </section>

        {/* The clan war in numbers, straight from the game */}
        <section className="border-y border-[var(--pf-line)] bg-[var(--pf-surface)]">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
            {NUMBERS.map(([value, label], i) => (
              <div key={label} className={cn("px-4 py-8 sm:px-6 md:py-10", i % 2 === 1 && "border-l border-[var(--pf-line)]", i >= 2 && "border-t border-[var(--pf-line)] md:border-t-0", i === 2 && "md:border-l")}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-[family-name:var(--pf-display)] text-5xl font-extrabold leading-none text-[var(--pf-gold)] md:text-6xl">{value}</dd>
                <dd className="mt-2 font-bold text-[var(--pf-muted)]" aria-hidden>{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The road to the top clan */}
        <section id="gia-toc" className="mx-auto grid max-w-7xl scroll-mt-20 gap-12 px-4 py-24 sm:px-6 md:py-32 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className={H2}>Từ một bé tới cả một gia tộc.</h2>
            <p className={LEAD}>Gia tộc góp quỹ, mua đất, mở ngành và chia cổ tức. Gia tộc mạnh nhất nắm cả chợ.</p>
            <a href={`${WIKI_ORIGIN}/gia-toc`} className="mt-6 inline-flex items-center gap-1.5 font-bold text-[var(--pf-gold)] hover:underline">
              Luật gia tộc đầy đủ trên Wiki <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            </a>
          </Reveal>
          <ol className="divide-y divide-[var(--pf-line)] border-y border-[var(--pf-line)]">
            {CLAN_ROAD.map(({ title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 80} className="grid grid-cols-[3.5rem_1fr] gap-4 py-7 md:grid-cols-[5rem_1fr] md:py-9">
                  <span className="font-[family-name:var(--pf-display)] text-4xl font-extrabold leading-none text-[var(--pf-gold)]/70 md:text-5xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold md:text-3xl">{title}</h3>
                    <p className="mt-2 max-w-[52ch] text-[var(--pf-muted)]">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* The town */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:pb-32">
          <Reveal className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <h2 className={H2}>Phố Trân Châu là sân chơi.</h2>
            <p className="max-w-[44ch] text-lg leading-relaxed text-[var(--pf-muted)]">Việc làm, ngân hàng, siêu thị, trường học, chợ phiên và khu công nghiệp. Chạm vào tòa nhà nào là vào tòa nhà đó.</p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <Shot src="/petfarm/map.webp" alt="Bản đồ Phố Trân Châu với các tòa nhà: nhà, siêu thị, việc làm, ngân hàng, Sàn Nguyên Liệu, tòa thị chính, trường học, phòng khám, công viên, bếp, vườn, chợ phiên" width={1600} height={961} />
          </Reveal>
        </section>

        {/* A day in town: bento of the core loop */}
        <section id="cach-choi" className="scroll-mt-20 border-y border-[var(--pf-line)] bg-[var(--pf-surface)] py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal>
              <h2 className={H2}>Mỗi ngày một nước cờ.</h2>
              <p className={LEAD}>Bé vui thì làm tốt, làm tốt thì có xu, có xu thì buôn bán và góp quỹ cho gia tộc.</p>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-6">
              <Reveal className="md:col-span-4 md:row-span-2">
                <article className={cn(PANEL, "flex h-full flex-col overflow-hidden bg-[var(--pf-bg)]")}>
                  <Image src="/petfarm/room.webp" alt="Bé Bông đội mũ quý ông, đeo kính tròn và cánh thiên thần trong phòng" width={1000} height={739} unoptimized className="h-auto w-full" />
                  <div className="p-6">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Nuôi bé</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Cho ăn, tắm, chơi đùa. Bé lớn theo ngày thật, có tính cách, hành và kỹ năng riêng.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={80}>
                <article className={cn(PANEL, "h-full bg-[var(--pf-surface-2)] p-6")}>
                  <Briefcase className="h-7 w-7 text-[var(--pf-gold)]" strokeWidth={2} />
                  <h3 className="mt-3 font-[family-name:var(--pf-display)] text-2xl font-extrabold">Đi làm</h3>
                  <p className="mt-1 text-[var(--pf-muted)]">5 nghề, mỗi nghề 5 bậc. Ca 1, 2 hoặc 4 giờ thật; kỹ năng càng cao lương càng khá.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={160}>
                <article className={cn(PANEL, "h-full bg-[var(--pf-bg)] p-6")}>
                  <Gamepad2 className="h-7 w-7 text-[var(--pf-gold)]" strokeWidth={2} />
                  <h3 className="mt-3 font-[family-name:var(--pf-display)] text-2xl font-extrabold">Mini-game</h3>
                  <p className="mt-1 text-[var(--pf-muted)]">Câu cá, hứng trân châu, ghép hình nhớ. Mỗi ván có thể rớt thêm vật liệu và trang phục.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-3">
                <article className={cn(PANEL, "h-full overflow-hidden bg-[var(--pf-bg)]")}>
                  <div className="p-6 pb-4">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Buôn bán</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Sàn Nguyên Liệu mở từ cấp {UNLOCKS.market}. Giá đổi theo cung cầu và tin tức: mua lúc rẻ, bán lúc đắt.</p>
                  </div>
                  <Image src="/petfarm/market.webp" alt="Sàn Nguyên Liệu: bảng giá các mặt hàng và biểu đồ giá sữa tươi trong 24 giờ" width={1600} height={1075} unoptimized className="h-auto w-full border-t border-[var(--pf-line)]" />
                </article>
              </Reveal>
              <Reveal className="md:col-span-3" delay={80}>
                <article className={cn(PANEL, "h-full overflow-hidden bg-[var(--pf-bg)]")}>
                  <div className="p-6 pb-4">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Gặp bạn</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Vào công viên trò chuyện, vẫy tay, vuốt ve bé của bạn bè và tặng quà. Bé của ai cũng có mặt.</p>
                  </div>
                  <Image src="/petfarm/park.webp" alt="Công viên với nhiều bé của người chơi quanh đài phun nước" width={1400} height={841} unoptimized className="h-auto w-full border-t border-[var(--pf-line)]" />
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Tiered gear */}
        <section id="trang-phuc" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 md:py-32">
          <Reveal>
            <h2 className={H2}>Lên đồ cho bé chiến.</h2>
            <p className={LEAD}>Trang phục có 4 cấp. Mỗi món là một bản riêng; cấp càng cao càng nhiều dòng chỉ số cộng thẳng cho bé.</p>
          </Reveal>
          <ol className="mt-12 grid grid-cols-2 items-end gap-3 md:grid-cols-4 md:gap-4">
            {TIER_ORDER.map((t, i) => {
              const [lo, hi] = CONFIG.ranges[t].income;
              return (
                <li key={t} className={cn(["md:h-52", "md:h-60", "md:h-[17rem]", "md:h-[19rem]"][i])}>
                  <Reveal delay={i * 90} className="h-full">
                    <div className={cn(PANEL, "relative flex h-full flex-col justify-end overflow-hidden p-5")}>
                      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: TIERS[t].color }} />
                      <span className="mb-auto inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 font-[family-name:var(--pf-display)] text-sm font-bold text-white" style={{ background: TIERS[t].color }}>
                        {TIERS[t].name}
                      </span>
                      <p className="mt-4 font-[family-name:var(--pf-display)] text-4xl font-extrabold leading-none">{TIERS[t].lines}<span className="ml-1.5 text-lg text-[var(--pf-muted)]">dòng</span></p>
                      <p className="mt-2 text-sm text-[var(--pf-muted)]">+{lo} đến +{hi}% mỗi dòng</p>
                      <p className="text-sm text-[var(--pf-muted)]">{SHOP_TIERS.includes(t) ? `${shopShare(t)}% hộp mua ở cửa hàng` : "Từ mini-game, mã quà, Chợ Phiên"}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
          <div className="mt-14 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {AFFIX_COPY.map(({ key, icon: Icon, name, text }) => (
              <Reveal key={key} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--pf-line)] text-[var(--pf-gold)]">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-[family-name:var(--pf-display)] text-xl font-extrabold">{name}</h3>
                  <p className="text-[var(--pf-muted)]">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12">
            <Shot src="/petfarm/gear.webp" alt="Túi đồ với bốn món trang phục cấp Đỏ, Vàng, Xanh lục và Xanh lam cùng các dòng chỉ số" width={1600} height={425} />
          </Reveal>
        </section>

        {/* The legendaries, drawn live at their top form */}
        <section className="border-y border-[var(--pf-line)] bg-[var(--pf-surface)] py-24 md:py-32">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <Reveal>
              <h2 className={H2}>Năm huyền thoại, năm hành.</h2>
              <p className={LEAD}>Chỉ nở từ trứng ngũ hành. Đây là dáng {TOP_FORM.name} ở cấp {TOP_FORM.from}, dáng cao nhất của game.</p>
              <a href={`${WIKI_ORIGIN}/cac-loai`} className="mt-6 inline-flex items-center gap-1.5 font-bold text-[var(--pf-gold)] hover:underline">
                Xem cả {SPECIES_COUNT} loài trên Wiki <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              </a>
            </Reveal>
            <Reveal delay={100}>
              <PetRow items={legendaryPets(TOP_FORM.from)} />
            </Reveal>
          </div>
        </section>

        {/* Ways in */}
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 md:grid-cols-[1fr_1.2fr] md:py-32">
          <Reveal>
            <h2 className={H2}>Vào phố bằng cách nào cũng được.</h2>
            <p className={LEAD}>Một tài khoản dùng được trên mọi máy. Bé, xu và đồ đạc luôn đi theo bạn.</p>
          </Reveal>
          <ul className="divide-y divide-[var(--pf-line)] border-y border-[var(--pf-line)]">
            {[
              { icon: KeyRound, title: "Tạo tài khoản", text: "Chọn tên đăng nhập và mật khẩu, nhận ngay 150 xu chào mừng." },
              { icon: Link2, title: "Có link mời", text: "Bạn bè gửi link mời thì chỉ cần điền tên là vào chơi." },
              { icon: Gift, title: "Có mã quà", text: "Nhập mã ở menu tên của bạn trong game để nhận xu, vật phẩm hoặc trang phục." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 90} className="flex gap-4 py-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--pf-line)] text-[var(--pf-gold)]">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--pf-display)] text-xl font-extrabold">{title}</h3>
                    <p className="text-[var(--pf-muted)]">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* Questions */}
        <section id="hoi-dap" className="scroll-mt-20 border-t border-[var(--pf-line)] py-24 md:py-32">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <h2 className={H2}>Hỏi đáp</h2>
            </Reveal>
            <div className="mt-8 divide-y divide-[var(--pf-line)] border-y border-[var(--pf-line)]">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--pf-display)] text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span aria-hidden className="text-2xl leading-none text-[var(--pf-gold)] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-[var(--pf-muted)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Last call */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:pb-32">
          <Reveal>
            <div className="grid items-center overflow-hidden rounded-[10px] border border-[var(--pf-gold)]/40 bg-[var(--pf-surface)] md:grid-cols-[1.1fr_1fr]">
              <div className="p-8 md:p-12">
                <h2 className={H2}>Bục vàng đang trống.</h2>
                <p className={cn(LEAD, "mb-8")}>Nhận nuôi bé đầu tiên miễn phí, rủ bạn lập gia tộc và giành phố.</p>
                <PlayButton size="lg" />
              </div>
              <Image src="/petfarm/park.webp" alt="" width={1400} height={841} unoptimized className="h-full w-full object-cover md:border-l md:border-[var(--pf-line)]" />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[var(--pf-line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-[var(--pf-muted)] sm:px-6 md:flex-row md:items-center">
          <p className="font-[family-name:var(--pf-display)] text-xl font-extrabold text-[var(--pf-gold)]">
            <span aria-hidden>🧋</span> Petfarm
          </p>
          <p className="md:ml-4">{PLAY_DESCRIPTION}</p>
          <nav className="flex flex-wrap gap-5 font-bold md:ml-auto" aria-label="Chân trang">
            <a href={playUrl()} className="hover:text-[var(--pf-ink)]">Vào chơi</a>
            <a href="#gia-toc" className="hover:text-[var(--pf-ink)]">Gia tộc</a>
            <a href="#hoi-dap" className="hover:text-[var(--pf-ink)]">Hỏi đáp</a>
            <a href={WIKI_ORIGIN} className="hover:text-[var(--pf-ink)]">Wiki</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
