# Vorr

A minimal and fully type-safe HTTP/2 Node.js client library using the native `http2` module.

## Features

- ✅ Full TypeScript support with strict type checking
- ✅ Built on Node.js native `http2` module
- ✅ Simple, async/await API
- ✅ Session-based connection pooling
- ✅ Zero external dependencies (besides TypeScript for development)
- ✅ Supports both h2 and h2c protocols

## Installation

```bash
npm install vorr
```

## Quick Start

```typescript
import { Http2Session } from "http2js";

const session = new Http2Session("https://api.example.com");

// GET request
const response = await session.get("/users/1");
console.log(response.status); // number
console.log(response.headers); // Record<string, string>
console.log(await response.text()); // string

// JSON response
interface User {
  id: number;
  name: string;
}

const user = await response.json<User>();

session.close();
```

## Examples

### Basic GET Request

```typescript
import { Http2Session } from "http2js";

const session = new Http2Session("https://jsonplaceholder.typicode.com");

const response = await session.get("/posts/1");
console.log(`Status: ${response.status}`);
console.log(`Headers:`, response.headers);

const post = await response.json();
console.log(post);

session.close();
```

### POST Request with JSON Body

```typescript
import { Http2Session } from "http2js";

const session = new Http2Session("https://jsonplaceholder.typicode.com");

const data = {
  title: "New Post",
  body: "This is a new post",
  userId: 1,
};

const response = await session.post("/posts", {
  body: data, // Automatically serialized to JSON with appropriate headers
});

const created = await response.json();
console.log(created);

session.close();
```

### Custom Headers and Timeout

```typescript
import { Http2Session } from "http2js";

const session = new Http2Session("https://api.example.com", {
  headers: {
    "user-agent": "MyApp/1.0.0",
    "x-api-key": "your-api-key",
  },
  timeout: 5000,
});

const response = await session.get("/data", {
  headers: {
    "x-request-id": "123",
  },
  timeout: 10000,
});

console.log(response.status);

session.close();
```

### Type-Safe JSON Responses

```typescript
import { Http2Session } from "http2js";

interface ApiUser {
  id: number;
  name: string;
  email: string;
}

const session = new Http2Session("https://api.example.com");

const response = await session.get("/user/123");
const user = await response.json<ApiUser>();

console.log(user.name); // TypeScript knows this is a string
console.log(user.email); // TypeScript knows this is a string

session.close();
```

### Error Handling

```typescript
import { Http2Session } from "http2js";

const session = new Http2Session("https://api.example.com");

try {
  const response = await session.get("/data");

  if (response.status >= 400) {
    const error = await response.json();
    console.error("API Error:", error);
  } else {
    const data = await response.json();
    console.log("Success:", data);
  }
} catch (error) {
  console.error("Network/Timeout Error:", error);
} finally {
  session.close();
}
```

## License

MIT
