import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        BIG SANDY <span>CRIME WATCH</span>
      </Link>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/today">Today</Link>
        <Link href="/last-72-hours">Last 72 Hours</Link>
        <Link href="/county/rowan">Rowan</Link>
        <Link href="/county/pike">Pike</Link>
        <Link href="/category/bookings">Bookings</Link>
        <Link href="/search">Search</Link>
      </nav>
    </header>
  );
}
