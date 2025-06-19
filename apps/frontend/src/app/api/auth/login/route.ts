import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // --- MOCKED AUTHENTICATION ---
    // In a real application, you would:
    // 1. Find the user in the database by email.
    // 2. Compare the provided password with the hashed password stored in the database.
    // 3. If they match, create a session token (e.g., a JWT).
    console.log(`Login attempt for email: ${email}`);

    // For this example, we'll assume any login is successful
    const user = { id: 'user-123', email: email };
    
    // Create a mock session cookie
    const response = NextResponse.json({ user });
    response.cookies.set('auth_token', 'mock_jwt_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'An internal server error occurred' }, { status: 500 });
  }
} 