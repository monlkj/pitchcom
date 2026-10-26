/** Playing participation never grants or replaces staff permissions. */
export function participatesAsPlayer(member: { role?: string; playsAsPlayer?: boolean } | null | undefined): boolean {
  return !!member && (member.role === 'player' || ((member.role === 'manager' || member.role === 'coach') && member.playsAsPlayer === true));
}
