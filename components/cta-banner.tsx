import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";

type Props = { title: string; description: string; label?: string };
export function CtaBanner({ title, description, label = "Start a campaign" }: Props) {
  return <section className="section section-white"><div className="container"><div className="cta-panel"><div><h2>{title}</h2><p>{description}</p></div><Link className="button button-dark" href="/sign-in">{label}<ArrowUpRight /></Link></div></div></section>;
}
