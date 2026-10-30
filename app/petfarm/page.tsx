import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Baloo_2, Nunito } from "next/font/google";
import { ArrowRight, Briefcase, Clover, Gamepad2, Gift, KeyRound, Link2, Store, TrendingUp } from "lucide-react";
import { MeadowCanvas } from "@/components/tatua/meadow";
import { Reveal } from "@/components/petfarm/reveal";
import { cn } from "@/lib/utils";
import { PLAY_DESCRIPTION, SITE_ORIGIN, WIKI_ORIGIN, playUrl } from "@/lib/petdex-public";
import * as gear from "@/public/ta-tua/game/js/shared/gear.js";

// The Petfarm website (petfarm.online, rewritten to /petfarm by middleware.ts): one page about
// the game, in the game's own type (Baloo 2, Nunito) and milk-tea colours. Every picture is a real
// screenshot of the game (public/petfarm), and the hero is the live meadow of the sign-in page.
// Shapes: pictures and panels 24px, buttons 14px, chips full round.

const display = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "700", "800"], variable: "--pf-display", display: "swap" });
const body = Nunito({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"], variable: "--pf-body", display: "swap" });

const TITLE = "Petfarm · Nuôi bé, đi làm, cùng cả phố làm giàu";
const DESCRIPTION = "Game nuôi thú cưng nhiều người chơi trên trình duyệt: chăm bé, nhận ca làm, buôn bán trên Sàn và gặp bạn bè ở công viên.";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf4ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
};

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

const FAQ = [
  ["Chơi có mất phí không?", "Không. Vào trang chơi, tạo tài khoản bằng tên và mật khẩu là có 150 xu chào mừng để nhận nuôi bé đầu tiên."],
  ["Chơi trên điện thoại được không?", "Được. Game chạy ngay trên trình duyệt điện thoại và máy tính, không cần cài ứng dụng. Đăng nhập cùng tài khoản thì bé và xu đi theo bạn."],
  ["Không vào game thì bé có sao không?", "Bé vẫn sống theo giờ thật: đói dần, buồn dần, có thể ốm nếu bị bỏ quên lâu. Ghé thăm mỗi ngày, cho ăn và tắm là bé khỏe."],
  ["Nuôi được mấy bé?", "Tối đa 4 bé cùng lúc. Bé đầu tiên miễn phí, bé sau tốn 200 xu. Loài hiếm chỉ nở từ trứng ngũ hành."],
  ["Mã quà nhập ở đâu?", "Trong game, bấm vào tên mình ở góc trên rồi chọn Nhập mã quà. Mỗi mã chỉ nhận được một lần."],
] as const;

const STATS = [
  ["50", "loài thú ngũ hành"],
  ["25", "bậc nghề để leo"],
  ["10", "mặt hàng trên Sàn"],
  ["3", "mini-game mỗi ngày"],
] as const;

/** The one call to action, the same everywhere on the page. */
function PlayButton({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <a
      href={playUrl()}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[var(--pf-button)] font-[family-name:var(--pf-display)] font-bold text-[var(--pf-button-ink)]",
        "shadow-[0_4px_0_var(--pf-button-edge)] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_1px_0_var(--pf-button-edge)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pf-ring)]",
        size === "lg" ? "h-14 px-7 text-xl" : "h-11 px-5 text-lg",
        className,
      )}
    >
      Vào chơi <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
    </a>
  );
}

function Shot({ src, alt, width, height, className, priority }: { src: string; alt: string; width: number; height: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={cn("h-auto w-full rounded-[24px] border-2 border-[var(--pf-line)] shadow-[0_6px_0_var(--pf-line)]", className)}
    />
  );
}

const H2 = "font-[family-name:var(--pf-display)] text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl";
const LEAD = "mt-3 max-w-[60ch] text-lg leading-relaxed text-[var(--pf-muted)]";

export default function PetfarmSite() {
  return (
    <div
      className={cn(
        display.variable,
        body.variable,
        "min-h-dvh bg-[var(--pf-bg)] font-[family-name:var(--pf-body)] text-[var(--pf-ink)] antialiased",
        "[--pf-bg:#fbf4ea] [--pf-glass:rgba(255,250,243,0.9)] [--pf-surface:#fffaf3] [--pf-surface-2:#f4e8d6] [--pf-ink:#3b2a1e] [--pf-muted:#6f5a49] [--pf-line:#ead8c0]",
        "[--pf-accent:#9b6238] [--pf-button:#9b6238] [--pf-button-ink:#fffaf3] [--pf-button-edge:#6e4222] [--pf-ring:#c8915f66]",
        "dark:[--pf-bg:#1a1410] dark:[--pf-glass:rgba(36,28,22,0.9)] dark:[--pf-surface:#241c16] dark:[--pf-surface-2:#2e241c] dark:[--pf-ink:#f6eadb] dark:[--pf-muted:#c3ae97] dark:[--pf-line:#3d3027]",
        "dark:[--pf-accent:#e3b48a] dark:[--pf-button:#e0a874] dark:[--pf-button-ink:#2a190d] dark:[--pf-button-edge:#9b6238] dark:[--pf-ring:#e0a87466]",
      )}
    >
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[14px] focus:bg-[var(--pf-surface)] focus:px-4 focus:py-2">
        Bỏ qua tới nội dung
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--pf-line)] bg-[var(--pf-glass)] backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Chính">
          <a href="#" className="flex items-center gap-2 font-[family-name:var(--pf-display)] text-2xl font-extrabold text-[var(--pf-accent)]">
            <span aria-hidden>🧋</span> Petfarm
          </a>
          <div className="ml-auto hidden items-center gap-6 text-[15px] font-bold text-[var(--pf-muted)] md:flex">
            <a href="#cach-choi" className="hover:text-[var(--pf-ink)]">Cách chơi</a>
            <a href="#trang-phuc" className="hover:text-[var(--pf-ink)]">Trang phục</a>
            <a href="#hoi-dap" className="hover:text-[var(--pf-ink)]">Hỏi đáp</a>
            <a href={WIKI_ORIGIN} className="hover:text-[var(--pf-ink)]">Wiki</a>
          </div>
          <PlayButton className="ml-auto h-10 px-4 text-base md:ml-0" />
        </nav>
      </header>

      <main id="noi-dung">
        {/* Hero: the live meadow, with the game's own pets walking about */}
        <section className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden">
          <MeadowCanvas />
          <div className="pointer-events-none relative mx-auto flex max-w-6xl px-4 pt-8 sm:px-6 md:pt-16">
            <div
              data-meadow-card
              className="pointer-events-auto w-full max-w-2xl rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-glass)] p-6 shadow-[0_6px_0_var(--pf-line)] backdrop-blur-sm sm:p-8"
            >
              <p className="font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--pf-accent)]">{PLAY_DESCRIPTION}</p>
              <h1 className="mt-2 font-[family-name:var(--pf-display)] text-[2.15rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]">
                Nuôi bé, đi làm, cùng cả phố làm giàu.
              </h1>
              <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-[var(--pf-muted)]">
                Chăm bé, nhận ca làm, buôn bán trên Sàn và gặp bạn bè ở công viên. Chơi ngay trên trình duyệt.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <PlayButton size="lg" />
                <a href="#cach-choi" className="inline-flex h-14 items-center rounded-[14px] px-4 font-[family-name:var(--pf-display)] text-lg font-bold text-[var(--pf-accent)] hover:bg-[var(--pf-surface-2)]">
                  Xem cách chơi
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The town */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <Reveal>
            <h2 className={H2}>Phố Trân Châu có đủ cả.</h2>
            <p className={LEAD}>Việc làm, ngân hàng, siêu thị, trường học, phòng khám, bếp, vườn, chợ phiên và khu công nghiệp. Chạm vào tòa nhà nào là vào tòa nhà đó.</p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <Shot src="/petfarm/map.webp" alt="Bản đồ Phố Trân Châu với các tòa nhà: nhà, siêu thị, việc làm, ngân hàng, Sàn Nguyên Liệu, tòa thị chính, trường học, phòng khám, công viên, bếp, vườn, chợ phiên" width={1600} height={961} />
          </Reveal>
        </section>

        {/* A day in town: bento of the core loop */}
        <section id="cach-choi" className="scroll-mt-20 bg-[var(--pf-surface)] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <h2 className={H2}>Một ngày ở phố.</h2>
              <p className={LEAD}>Mỗi việc nhỏ đều có ích: bé vui thì làm tốt, làm tốt thì có xu, có xu thì buôn bán và nuôi thêm bé.</p>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-6">
              <Reveal className="md:col-span-4 md:row-span-2">
                <article className="flex h-full flex-col overflow-hidden rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-bg)]">
                  <Image src="/petfarm/room.webp" alt="Bé Bông đội mũ quý ông, đeo kính tròn và cánh thiên thần trong phòng" width={1000} height={739} unoptimized className="h-auto w-full" />
                  <div className="p-6">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Nuôi bé</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Cho ăn, tắm, chơi đùa. Bé lớn theo ngày thật, có tính cách, hành và kỹ năng riêng.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={80}>
                <article className="h-full rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface-2)] p-6">
                  <Briefcase className="h-7 w-7 text-[var(--pf-accent)]" strokeWidth={2.2} />
                  <h3 className="mt-3 font-[family-name:var(--pf-display)] text-2xl font-extrabold">Đi làm</h3>
                  <p className="mt-1 text-[var(--pf-muted)]">5 nghề, mỗi nghề 5 bậc. Ca 1, 2 hoặc 4 giờ thật; kỹ năng càng cao lương càng khá.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={160}>
                <article className="h-full rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-bg)] p-6">
                  <Gamepad2 className="h-7 w-7 text-[var(--pf-accent)]" strokeWidth={2.2} />
                  <h3 className="mt-3 font-[family-name:var(--pf-display)] text-2xl font-extrabold">Mini-game</h3>
                  <p className="mt-1 text-[var(--pf-muted)]">Câu cá, hứng trân châu, ghép hình nhớ. Mỗi ván có thể rớt thêm vật liệu và trang phục.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-3">
                <article className="h-full overflow-hidden rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-bg)]">
                  <div className="p-6 pb-4">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Buôn bán</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Giá trên Sàn Nguyên Liệu đổi mỗi 10 phút theo cung cầu và tin tức. Mua lúc rẻ, bán lúc đắt.</p>
                  </div>
                  <Image src="/petfarm/market.webp" alt="Sàn Nguyên Liệu: bảng giá 10 mặt hàng và biểu đồ giá sữa tươi trong 24 giờ" width={1600} height={1075} unoptimized className="h-auto w-full border-t-2 border-[var(--pf-line)]" />
                </article>
              </Reveal>
              <Reveal className="md:col-span-3" delay={80}>
                <article className="h-full overflow-hidden rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-bg)]">
                  <div className="p-6 pb-4">
                    <h3 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold">Gặp bạn</h3>
                    <p className="mt-1 text-[var(--pf-muted)]">Vào công viên trò chuyện, vẫy tay, vuốt ve bé của bạn bè và tặng quà. Bé của ai cũng có mặt.</p>
                  </div>
                  <Image src="/petfarm/park.webp" alt="Công viên với nhiều bé của người chơi quanh đài phun nước" width={1400} height={841} unoptimized className="h-auto w-full border-t-2 border-[var(--pf-line)]" />
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Tiered gear */}
        <section id="trang-phuc" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
          <Reveal>
            <h2 className={H2}>Trang phục có 4 cấp.</h2>
            <p className={LEAD}>Mỗi món đồ đeo là một bản riêng. Cấp càng cao càng nhiều dòng chỉ số, mỗi dòng cộng thẳng cho bé đang đeo.</p>
          </Reveal>
          <ol className="mt-12 grid grid-cols-2 items-end gap-4 md:grid-cols-4">
            {TIER_ORDER.map((t, i) => {
              const [lo, hi] = CONFIG.ranges[t].income;
              return (
                <li key={t} className={cn(["md:h-52", "md:h-60", "md:h-[17rem]", "md:h-[19rem]"][i])}>
                  <Reveal delay={i * 90} className="h-full">
                    <div className="flex h-full flex-col justify-end rounded-[24px] border-2 bg-[var(--pf-surface)] p-5 shadow-[0_6px_0_var(--tier)]" style={{ borderColor: TIERS[t].color, ["--tier" as string]: TIERS[t].color }}>
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
          <div className="mt-14 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {AFFIX_COPY.map(({ key, icon: Icon, name, text }) => (
              <Reveal key={key} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pf-surface-2)] text-[var(--pf-accent)]">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
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

        {/* The game in numbers */}
        <section className="border-y-2 border-[var(--pf-line)] bg-[var(--pf-surface-2)]">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-14 sm:px-6 md:grid-cols-4">
            {STATS.map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-[family-name:var(--pf-display)] text-5xl font-extrabold leading-none text-[var(--pf-accent)] md:text-6xl">{value}</dd>
                <dd className="mt-2 font-bold text-[var(--pf-muted)]" aria-hidden>{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Ways in */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr] md:py-28">
          <Reveal>
            <h2 className={H2}>Vào phố bằng cách nào cũng được.</h2>
            <p className={LEAD}>Một tài khoản dùng được trên mọi máy. Bé, xu và đồ đạc luôn đi theo bạn.</p>
          </Reveal>
          <ul className="space-y-4">
            {[
              { icon: KeyRound, title: "Tạo tài khoản", text: "Chọn tên đăng nhập và mật khẩu, nhận ngay 150 xu chào mừng." },
              { icon: Link2, title: "Có link mời", text: "Bạn bè gửi link mời thì chỉ cần điền tên là vào chơi." },
              { icon: Gift, title: "Có mã quà", text: "Nhập mã ở menu tên của bạn trong game để nhận xu, vật phẩm hoặc trang phục." },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 90} className="flex gap-4 rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pf-surface-2)] text-[var(--pf-accent)]">
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
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
        <section id="hoi-dap" className="scroll-mt-20 bg-[var(--pf-surface)] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <h2 className={H2}>Hỏi đáp</h2>
            </Reveal>
            <div className="mt-8 space-y-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-bg)] px-5 py-4 open:pb-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--pf-display)] text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span aria-hidden className="text-2xl leading-none text-[var(--pf-accent)] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-[var(--pf-muted)]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Last call */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <Reveal>
            <div className="grid items-center gap-8 overflow-hidden rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface-2)] md:grid-cols-[1.1fr_1fr]">
              <div className="p-8 md:p-12">
                <h2 className={H2}>Bé đang chờ ở công viên.</h2>
                <p className={cn(LEAD, "mb-8")}>Nhận nuôi bé đầu tiên miễn phí và ghé phố mỗi ngày.</p>
                <PlayButton size="lg" />
              </div>
              <Image src="/petfarm/park.webp" alt="" width={1400} height={841} unoptimized className="h-full w-full object-cover md:border-l-2 md:border-[var(--pf-line)]" />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t-2 border-[var(--pf-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-[var(--pf-muted)] sm:px-6 md:flex-row md:items-center">
          <p className="font-[family-name:var(--pf-display)] text-xl font-extrabold text-[var(--pf-accent)]">
            <span aria-hidden>🧋</span> Petfarm
          </p>
          <p className="md:ml-4">{PLAY_DESCRIPTION}</p>
          <nav className="flex gap-5 font-bold md:ml-auto" aria-label="Chân trang">
            <a href={playUrl()} className="hover:text-[var(--pf-ink)]">Vào chơi</a>
            <a href="#cach-choi" className="hover:text-[var(--pf-ink)]">Cách chơi</a>
            <a href="#hoi-dap" className="hover:text-[var(--pf-ink)]">Hỏi đáp</a>
            <a href={WIKI_ORIGIN} className="hover:text-[var(--pf-ink)]">Wiki</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
