# http2js

A fully type-safe HTTP/2 Node.js client library using the native `http2` module.

## Features

- ✅ Full TypeScript support with strict type checking
- ✅ Built on Node.js native `http2` module
- ✅ Simple, async/await API
- ✅ Session-based connection pooling
- ✅ Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- ✅ JSON parsing with generics
- ✅ Custom headers support
- ✅ Request body support
- ✅ Response streaming
- ✅ Zero external dependencies (besides TypeScript for development)

## Installation

```bash
npm install http2js
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

## API

### Http2Session

#### Constructor

```typescript
constructor(origin: string, options?: Http2SessionOptions)
```

Creates a new HTTP/2 session to the specified origin.

**Parameters:**
- `origin` - The server URL (e.g., `https://api.example.com`)
- `options` - Optional session configuration

**Options:**
```typescript
interface Http2SessionOptions {
  headers?: Record<string, string | string[]>; // Default headers for all requests
  timeout?: number; // Default timeout in milliseconds
}
```

#### Methods

##### `get(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP GET request.

##### `post(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP POST request.

##### `put(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP PUT request.

##### `delete(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP DELETE request.

##### `patch(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP PATCH request.

##### `head(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP HEAD request.

##### `options(path: string, options?: Http2RequestOptions): Promise<Http2Response>`

Makes an HTTP OPTIONS request.

##### `close(): void`

Closes the HTTP/2 session and terminates the connection.

##### `isAlive(): boolean`

Returns whether the session is still connected.

#### Request Options

```typescript
interface Http2RequestOptions {
  headers?: Record<string, string | string[]>; // Override headers for this request
  body?: string | Buffer; // Request body
  timeout?: number; // Request timeout in milliseconds
}
```

### Http2Response

#### Properties

##### `status: number`

The HTTP status code of the response.

##### `headers: Record<string, string>`

Response headers as a key-value object.

##### `body: Buffer`

Raw response body as a Buffer.

#### Methods

##### `async text(): Promise<string>`

Returns the response body as a UTF-8 string.

##### `async json<T = unknown>(): Promise<T>`

Parses and returns the response body as JSON with optional type parameter.

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

const data = JSON.stringify({
  title: "New Post",
  body: "This is a new post",
  userId: 1,
});

const response = await session.post("/posts", {
  headers: {
    "content-type": "application/json",
  },
  body: data,
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
  console.error("Network Error:", error);
} finally {
  session.close();
}
```

## Build

```bash
npm run build
```

## Development

```bash
npm run dev
```

## License

MIT
