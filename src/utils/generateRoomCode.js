// Generates a random 6-character uppercase alphanumeric code
export const generateRoomCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omitted confusing chars (0, O, 1, I)
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
};