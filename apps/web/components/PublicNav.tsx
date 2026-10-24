import PublicArrow from "@/components/PublicArrow";
import Link from 'next/link';
export default function PublicNav() {
  return <header className="public-nav"><Link href="/" className="public-brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>contrigraph.</Link><nav aria-label="Main navigation"><Link href="/#product">Product</Link><Link href="/help">Help & guides</Link><Link href="/faq">FAQs</Link></nav><div className="public-actions"><Link href="/login">Log in</Link><Link href="/app?signup=1" className="public-button">Get started <span aria-hidden="true"><PublicArrow /></span></Link></div></header>;
}
