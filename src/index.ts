export interface Env {
  FIREBASE_URL: string;
  FIREBASE_SECRET: string;
}

interface User {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

class AuthWorker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private async makeFirebaseRequest(path: string, method: string = 'GET', data?: any): Promise<any> {
    const url = `${this.env.FIREBASE_URL}${path}.json?auth=${this.env.FIREBASE_SECRET}`;
    console.log("Request URL:", url); // ✅ طباعة عنوان الطلب

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    const responseBody = await response.text(); // ✅ ناخد نص الاستجابة حتى لو فيها خطأ
    console.log("Firebase response:", responseBody);

    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status} - ${responseBody}`);
    }

    return JSON.parse(responseBody);
  }

  private async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.makeFirebaseRequest(`/users/${this.emailToKey(email)}`);
      return user;
    } catch (error) {
      console.error("getUserByEmail error:", error);
      return null;
    }
  }

  private emailToKey(email: string): string {
    return email.replace(/[.#$\[\]]/g, '_');
  }

  private async createUser(email: string, password: string): Promise<void> {
    const userData: User = { email, password };
    await this.makeFirebaseRequest(`/users/${this.emailToKey(email)}`, 'PUT', userData);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private createResponse(message: string, status: number): Response {
    return new Response(JSON.stringify({ message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  async handleSignup(request: Request): Promise<Response> {
    try {
      console.log("FIREBASE_URL:", this.env.FIREBASE_URL); // ✅
      console.log("FIREBASE_SECRET:", this.env.FIREBASE_SECRET); // ✅

      const body: SignupRequest = await request.json();

      if (!body.email || !body.password) {
        return this.createResponse('Email and password are required', 400);
      }

      if (!this.isValidEmail(body.email)) {
        return this.createResponse('Invalid email format', 400);
      }

      if (body.password.length < 6) {
        return this.createResponse('Password must be at least 6 characters', 400);
      }

      const existingUser = await this.getUserByEmail(body.email);

      if (existingUser) {
        return this.createResponse('User already exists', 400);
      }

      await this.createUser(body.email, body.password);

      return this.createResponse('User created successfully ✅', 201);
    } catch (error: any) {
      const message = error?.message || "Unknown error";
      console.error("Signup error:", message); // ✅ طباعة الخطأ بالتفصيل
      return this.createResponse(`Signup failed: ${message}`, 500);
    }
  }

  async handleLogin(request: Request): Promise<Response> {
    try {
      const body: LoginRequest = await request.json();

      if (!body.email || !body.password) {
        return this.createResponse('Email and password are required', 400);
      }

      if (!this.isValidEmail(body.email)) {
        return this.createResponse('Invalid email format', 400);
      }

      const user = await this.getUserByEmail(body.email);

      if (!user || user.password !== body.password) {
        return this.createResponse('Invalid credentials', 401);
      }

      return this.createResponse('Login successful 🎉', 200);
    } catch (error: any) {
      const message = error?.message || "Unknown error";
      console.error("Login error:", message);
      return this.createResponse(`Login failed: ${message}`, 500);
    }
  }

  async handleOptions(): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const authWorker = new AuthWorker(env);
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return authWorker.handleOptions();
    }

    if (method === 'POST' && url.pathname === '/signup') {
      return authWorker.handleSignup(request);
    }

    if (method === 'POST' && url.pathname === '/login') {
      return authWorker.handleLogin(request);
    }

    if (method === 'GET' && url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Auth API Server is running! 🚀',
        endpoints: [
          'POST /signup - Create new user',
          'POST /login - User login'
        ]
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ message: 'Route not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
