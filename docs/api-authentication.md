# API Authentication Documentation

## Overview

The Event Manager API supports two authentication methods:
1. **Cookie-based authentication** (for web applications)
2. **Bearer token authentication** (for mobile apps, MCP clients, and third-party integrations)

MCP (Model Context Protocol) uses the same Bearer token at `POST /api/mcp`. See the README MCP section.

## Authentication Flow

### Web Application (Cookie-based)

1. User signs in via Google OAuth at `/`
2. NextAuth creates a session cookie
3. All subsequent requests include the cookie automatically
4. No additional authentication headers needed

### Mobile Application (Bearer Token)

1. User authenticates with Google OAuth in mobile app
2. App sends authentication details to `/api/auth/token`
3. API returns access token and refresh token
4. App includes access token in `Authorization` header for all API requests
5. When access token expires, use refresh token to get new access token

## Endpoints

### POST /api/auth/token

Authenticate and receive JWT tokens for mobile clients.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "image": "https://example.com/photo.jpg",
  "googleId": "123456789"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6...",
  "expiresIn": 604800,
  "user": {
    "id": "clx123abc",
    "name": "John Doe",
    "email": "user@example.com",
    "image": "https://example.com/photo.jpg",
    "globalRole": "VIEWER"
  }
}
```

**Notes:**
- Access token valid for 7 days
- Refresh token valid for 30 days
- Only users with existing accounts, volunteer records, or super admin email can sign in

### POST /api/auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "x9y8z7w6v5u4...",
  "expiresIn": 604800,
  "user": {
    "id": "clx123abc",
    "name": "John Doe",
    "email": "user@example.com",
    "image": "https://example.com/photo.jpg",
    "globalRole": "VIEWER"
  }
}
```

**Notes:**
- Returns a new access token and rotates the refresh token
- Old refresh token is deleted for security

## Using Bearer Tokens

### Authorization Header

Include the access token in the `Authorization` header for all API requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Example Requests

**cURL:**
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-app.com/api/events
```

**JavaScript (fetch):**
```javascript
const response = await fetch('https://your-app.com/api/events', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

**React Native:**
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store tokens
await AsyncStorage.setItem('accessToken', data.accessToken);
await AsyncStorage.setItem('refreshToken', data.refreshToken);

// Make authenticated request
const accessToken = await AsyncStorage.getItem('accessToken');
const response = await fetch('https://your-app.com/api/events', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

// Handle token expiration
if (response.status === 401) {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  const refreshResponse = await fetch('https://your-app.com/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (refreshResponse.ok) {
    const data = await refreshResponse.json();
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);
    // Retry original request with new token
  }
}
```

**Flutter:**
```dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// Store tokens
final prefs = await SharedPreferences.getInstance();
await prefs.setString('accessToken', data['accessToken']);
await prefs.setString('refreshToken', data['refreshToken']);

// Make authenticated request
final accessToken = prefs.getString('accessToken');
final response = await http.get(
  Uri.parse('https://your-app.com/api/events'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json'
  },
);

// Handle token expiration
if (response.statusCode == 401) {
  final refreshToken = prefs.getString('refreshToken');
  final refreshResponse = await http.post(
    Uri.parse('https://your-app.com/api/auth/refresh'),
    headers: {'Content-Type': 'application/json'},
    body: json.encode({'refreshToken': refreshToken}),
  );
  
  if (refreshResponse.statusCode == 200) {
    final data = json.decode(refreshResponse.body);
    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);
    // Retry original request with new token
  }
}
```

## Protected Endpoints

All API endpoints (except `/api/auth/*`) require authentication:

- `/api/dashboard` - Get dashboard statistics
- `/api/events` - List and create events
- `/api/events/[id]` - Get, update, delete event
- `/api/speakers` - List and create speakers
- `/api/volunteers` - List and create volunteers
- `/api/members` - Manage team members (ADMIN only)
- `/api/templates` - SOP templates
- `/api/checklists` - Event checklists
- `/api/audit-log` - Audit logs (ADMIN only)

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Cause:** Missing or invalid access token

**Solution:** Sign in again or refresh your access token

### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```
**Cause:** Valid authentication but insufficient permissions

**Solution:** Contact an administrator for proper role assignment

## Security Best Practices

1. **Store tokens securely**
   - Use secure storage (Keychain on iOS, KeyStore on Android)
   - Never log tokens or include them in error reports

2. **Handle token rotation**
   - Implement automatic refresh token logic
   - Clear tokens on logout

3. **Use HTTPS**
   - Always use HTTPS in production
   - Never send tokens over insecure connections

4. **Token expiration**
   - Access tokens expire in 7 days
   - Refresh tokens expire in 30 days
   - Implement proper expiry handling

## Roles and Permissions

The API uses a role-based access control system:

| Role | Level | Description |
|------|-------|-------------|
| SUPER_ADMIN | 4 | Full system access |
| ADMIN | 3 | User management, system settings |
| EVENT_LEAD | 2 | Create and manage events |
| VOLUNTEER | 1 | View assigned events, update tasks |
| VIEWER | 0 | Basic read access |

### Role Requirements by Endpoint

- **ADMIN required:**
  - `POST /api/members` - Create/update users
  - `GET /api/audit-log` - View audit logs
  - `POST /api/discord/config` - Configure Discord

- **EVENT_LEAD required:**
  - `POST /api/events` - Create events

- **Event-level permissions:**
  - Event LEAD/ORGANIZER can modify event details
  - Event VOLUNTEER can update assigned tasks
  - Super Admin and Admin have access to all events

## Testing Authentication

Use cURL to test Bearer token authentication:

```bash
# 1. Get access token (replace with your credentials)
curl -X POST https://your-app.com/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John Doe"}'

# 2. Use access token to make authenticated request
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-app.com/api/events

# 3. Refresh token
curl -X POST https://your-app.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

## Migration from Cookie-only Auth

Existing web applications using cookie-based auth will continue to work without changes. The Bearer token authentication is additive and provides mobile compatibility without breaking existing functionality.
