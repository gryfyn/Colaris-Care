import { NextResponse } from 'next/server';
import { deleteAuthCookies } from '@/lib/auth-cookies.js';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  deleteAuthCookies(response);
  return response;
}
