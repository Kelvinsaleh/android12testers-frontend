type Props = { eyebrow?: string; title: string; description?: string; align?: "left" | "center" };
export function SectionHeading({ eyebrow, title, description, align = "left" }: Props) {
  return <div className={`section-heading ${align === "center" ? "section-heading-center" : ""}`}>
    {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
  </div>;
}
