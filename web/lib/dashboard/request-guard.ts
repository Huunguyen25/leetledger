export interface SessionRequestToken {
  generation: number;
  userId: string;
}

export function isCurrentSessionRequest(
  token: SessionRequestToken,
  currentGeneration: number,
  currentUserId: string | null,
) {
  return (
    token.generation === currentGeneration &&
    token.userId === currentUserId
  );
}
