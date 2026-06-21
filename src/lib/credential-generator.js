// Generate secure usernames and passwords for new accounts

export function generateUsername(firstName, lastName, existingUsernames = []) {
  const base = `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase()}`.replace(/[^a-z]/g, '');
  let username = base;
  let counter = 1;

  while (existingUsernames.includes(username)) {
    username = `${base}${counter}`;
    counter++;
  }

  return username;
}

export function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_=+';

  const allChars = uppercase + lowercase + numbers + symbols;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export function generateCredentials(firstName, lastName, type = 'staff') {
  const username = generateUsername(firstName, lastName);
  const password = generatePassword();

  return {
    username,
    password,
    temporaryCredentials: true,
    credentialType: type,
    generatedAt: new Date().toISOString(),
  };
}
