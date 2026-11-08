import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ArrowUpRight(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function CheckIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ShieldIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M12 3 20 6v5.7c0 4.8-3.3 7.9-8 9.3-4.7-1.4-8-4.5-8-9.3V6l8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function CalendarIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
export function UsersIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20M9.5 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM16 4.2a3.75 3.75 0 0 1 0 7.3M17.6 15h.0a3.4 3.4 0 0 1 3.4 3.4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
