# SafarisCon Mobile Integration Guide

This document explains how the current working web frontend integrates with the SafarisCon backend and how the same behavior should be reproduced in the mobile app. It is based on the actual frontend code in `src/lib/api.js`, `src/context/AuthContext.jsx`, the booking form, and the customer, provider, and admin dashboards.

## 1. Architecture Summary

The web app is a React/Vite frontend. All backend communication is centralized in `src/lib/api.js`.

Mobile should copy this architecture:

- Create one API client module.
- Keep the backend base URL in environment config.
- Store the authenticated user and token securely.
- Add `Authorization: Bearer <token>` on private requests.
- Keep role-based routing/navigation in one place.
- Reuse the same endpoint paths and payload shapes as the web app.

Current web API base URL:

```js
VITE_API_BASE_URL || "http://localhost:5000"
```

For production mobile, use the deployed backend URL, not localhost. Mobile devices cannot call the developer machine's `localhost` unless using an emulator-specific address or a tunnel.

## 2. Shared API Client Rules

Every JSON request should:

- Send `Content-Type: application/json`.
- Serialize the request body with `JSON.stringify`.
- Parse the response as JSON.
- Treat non-2xx responses as errors.
- Preserve backend error fields such as `message`, `code`, and `status`.

Private requests should add:

```http
Authorization: Bearer <token>
```

Image uploads should use `FormData` and should not manually set `Content-Type`, because the platform must set the multipart boundary.

Mobile storage should use secure storage:

- React Native: `expo-secure-store`, `react-native-keychain`, or equivalent.
- Native iOS: Keychain.
- Native Android: EncryptedSharedPreferences or Keystore-backed storage.

Do not store the token in plain AsyncStorage unless there is no secure alternative.

## 3. Auth State and Roles

The web app stores auth data under:

```js
{
  user: result.user,
  token: result.token
}
```

Web storage key:

```js
tourconnect_auth
```

Mobile should store the same object shape, but in secure storage.

Supported role groups:

```js
customer roles: ["tourist", "customer"]
seller/provider roles: ["hotel", "supplier"]
admin role: "admin"
```

Dashboard routing logic:

```js
if (!user) return login
if (user.role === "admin") return admin dashboard
if (["hotel", "supplier"].includes(user.role)) return provider dashboard
return customer dashboard
```

## 4. Authentication Flows

### Login

Frontend source: `src/pages/LoginPage.jsx`, `src/context/AuthContext.jsx`

Endpoint:

```http
POST /api/auth/login
```

Payload:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Success response expected by frontend:

```json
{
  "user": {
    "_id": "...",
    "name": "...",
    "email": "...",
    "role": "customer",
    "emailVerified": true
  },
  "token": "jwt-token"
}
```

Mobile behavior:

- Save `{ user, token }`.
- Navigate by role.
- If the backend returns `403` with code `EMAIL_NOT_VERIFIED`, open email verification and pass the email.

### Customer Registration

Frontend source: `src/pages/RegisterPage.jsx`

Endpoint:

```http
POST /api/auth/register
```

Payload:

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "password": "password",
  "role": "customer"
}
```

Validation done on frontend:

- Password and confirm password must match.
- Web checks minimum password length of 6 for registration.
- If `emailVerification.required` or `user.emailVerified === false`, navigate to email verification.

Mobile should do the same validation before calling the API.

### Email Verification

Frontend source: `src/pages/EmailVerificationPage.jsx`

Verify OTP:

```http
POST /api/auth/email/verify-otp
```

Payload:

```json
{
  "email": "customer@example.com",
  "otp": "123456"
}
```

Resend OTP:

```http
POST /api/auth/email/resend-verification-otp
```

Payload:

```json
{
  "email": "customer@example.com"
}
```

On successful verification, save `{ user, token }` and navigate by role.

### Forgot and Reset Password

Frontend sources: `src/pages/ForgotPasswordPage.jsx`, `src/pages/ResetPasswordPage.jsx`

Forgot password:

```http
POST /api/auth/forgot-password
```

Payload:

```json
{
  "email": "user@example.com"
}
```

Reset password:

```http
POST /api/auth/reset-password
```

Payload:

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "new-password"
}
```

Mobile validation:

- New password and confirm password must match.
- Web reset form requires at least 8 characters.

### Logout

Frontend source: `src/context/AuthContext.jsx`

Logout is local-only:

- Clear secure auth storage.
- Set user state to null.
- Navigate to login or public home.

There is no logout endpoint in the current frontend integration.

## 5. Provider Registration and Onboarding

There are two provider-related flows.

### Admin-Created Provider Completion

Frontend source: `src/pages/ProviderCompleteRegistrationPage.jsx`

Admin creates a provider from the admin dashboard. The provider receives or is given:

- Provider name.
- Provider email.
- Seller/provider ID.

The provider completes setup here:

```http
POST /api/auth/provider/complete-registration
```

Payload:

```json
{
  "providerName": "Provider Name",
  "providerEmail": "provider@example.com",
  "sellerId": "SELLER-ID",
  "newPassword": "password",
  "confirmPassword": "password"
}
```

Mobile behavior:

- Allow provider to enter or open from a deep link containing `providerName`, `providerEmail`, and `sellerId`.
- Validate matching passwords.
- On success, navigate to email verification for the provider email.

### Public Business Registration

Frontend source: `src/pages/BusinessRegisterPage.jsx`

This form collects business owner and first listing details:

```json
{
  "businessName": "",
  "businessType": "hotel-rooms",
  "ownerName": "",
  "email": "",
  "phone": "",
  "location": "",
  "businessDescription": "",
  "serviceName": "",
  "serviceDescription": "",
  "servicePrice": "",
  "availabilityStatus": "available",
  "remainingQuantity": "1",
  "serviceImages": "",
  "password": "",
  "confirmPassword": ""
}
```

Important implementation note:

- The page currently calls `authApi.registerBusiness(formData)`.
- In `src/lib/api.js`, the registered method is `adminApi.registerBusiness(token, payload)` at `POST /api/admin/register-business`.
- Before building mobile for this public flow, confirm the backend endpoint intended for unauthenticated business registration. If the web is working in production, the local API wrapper may be out of sync with backend behavior and should be corrected in web too.

## 6. Public Catalog and Service Details

Frontend sources: `src/pages/HotelsPage.jsx`, `src/pages/HotelDetailsPage.jsx`, `src/lib/hotelMapper.js`

Load services/businesses:

```http
GET /api/hotels
```

The response may use either `businesses` or `hotels`. The web normalizes both.

Mobile should normalize each item to a consistent model:

- `id`: `_id || id`
- `name`, `description`, `location`
- `images`: up to 3 valid HTTP image URLs
- `serviceCategory` / `businessType`
- `primaryService`
- `availabilityTable`
- `bookingForm`
- `promotion`
- `status`
- `bookingMode`

Service detail screen should:

- Show image carousel/gallery.
- Show availability/price table rows.
- Show promotion if currently valid.
- Block booking if status is `unavailable`.
- Track service view analytics.

## 7. Customer Booking Flow

Frontend sources: `src/pages/BookingPage.jsx`, `src/components/BookingForm.jsx`

Booking screen requires an authenticated user. If no user exists, mobile should navigate to login.

### Data Loaded Before Booking

The booking form loads:

```http
GET /api/hotels
GET /api/marketplace-settings
```

It finds the selected business/service by route ID, then uses:

- `primaryService` or first `serviceItems` entry.
- `availabilityTable.rows` for selectable service options.
- `bookingForm.fields` for provider-defined custom questions.
- `marketplaceSettings.bookingRules`.
- `marketplaceSettings.bookingMode`.
- `business.bookingMode` or `service.bookingMode` when global mode is `service-level`.

### Fixed Booking Fields

The mobile form must include these fixed fields:

- Full name.
- Phone number.
- Email.
- Booking date.
- End booking date.
- Start time.
- End time.
- Number of people.
- Quantity / units.
- Customer location: province, district, sector, cell, village.
- Payment method.
- Terms agreement.
- Optional re-book ID.
- Provider custom fields.

Customer location is converted into a text address:

```text
Village, Cell, Sector, District, Province, Rwanda
```

### Booking Validation

Mobile should enforce the same validations:

- Service must exist and have `_id`.
- Service must not be unavailable.
- Customer must select a row from the seller price table.
- Full name is required.
- Phone must match a normal phone pattern.
- Email must be valid.
- Booking date and end date are required.
- End date cannot be before start date.
- Start and end time are required.
- People and quantity must be at least 1.
- Province, district, sector, cell, and village are required.
- Terms must be accepted.
- If using a re-book ID, it must be verified before submit.
- Required provider custom fields must be filled.

### Re-book ID Verification

Endpoint:

```http
POST /api/rebook/verify-id
```

Payload:

```json
{
  "rebookId": "RBK-2026-00124",
  "serviceId": "service-id"
}
```

Requires bearer token.

### Create Booking

The web calls:

```http
POST /api/bookings/request
```

through `bookingApi.bookService`.

Important mapping:

```js
hotelId = payload.serviceId
checkIn = payload.startDate
checkOut = payload.endDate
bookingDate = payload.startDate
endBookingDate = payload.endBookingDate || payload.endDate
guests = payload.numberOfPeople
```

Final request body:

```json
{
  "hotelId": "service-id",
  "rebookId": "optional-verified-rebook-id",
  "quantity": 1,
  "numberOfPeople": 2,
  "guests": 2,
  "totalConsumptionUnits": 2,
  "checkIn": "2026-08-01",
  "checkOut": "2026-08-02",
  "bookingDate": "2026-08-01",
  "endBookingDate": "2026-08-02",
  "startTime": "09:00",
  "endTime": "17:00",
  "totalPrice": 0,
  "destinationPlace": "Service name",
  "destinationLocation": "Service location",
  "customerLocation": "Village, Cell, Sector, District, Province, Rwanda",
  "customerLocationDetails": {
    "province": "Kigali City",
    "district": "Gasabo",
    "sector": "Remera",
    "cell": "Example Cell",
    "village": "Example Village"
  },
  "bookingDetails": {
    "customerLocationDetails": {},
    "serviceName": "Service name",
    "requestedService": "Selected table row",
    "selectedOptionId": "row-id",
    "listedPriceRwf": "20000",
    "fullName": "Customer Name",
    "email": "customer@example.com",
    "phone": "+250...",
    "bookingDate": "2026-08-01",
    "endBookingDate": "2026-08-02",
    "startTime": "09:00",
    "endTime": "17:00",
    "numberOfPeople": 2,
    "quantity": 1,
    "totalConsumptionUnits": 2,
    "customerLocation": "Village, Cell, Sector, District, Province, Rwanda",
    "paymentMethod": "mobile-money",
    "serviceCategory": "hotel-rooms",
    "bookingType": "accommodation",
    "providerRules": [],
    "customFormTitle": "Booking Request",
    "customResponses": [
      {
        "fieldId": "field_id",
        "label": "Question label",
        "type": "text",
        "value": "Customer answer"
      }
    ]
  }
}
```

### Manual vs Automatic Booking

Manual mode:

- Customer submits booking request.
- Admin reviews it.
- Admin sets total price, commission percentage, and payment reason.
- Customer can pay deposit after approval.

Automatic mode:

- Backend validates availability and calculates quote immediately.
- Response can include `{ booking, quote }`.
- Customer can pay 30% deposit immediately.

Mobile must support both modes.

## 8. Deposit Payment, Receipts, QR, and Verification

Frontend sources: `src/components/DepositPaymentModal.jsx`, `src/pages/UserDashboard.jsx`, `src/pages/VerificationPage.jsx`

Pay deposit:

```http
POST /api/bookings/:bookingId/pay
```

Payload:

```json
{
  "paymentMethod": "mobile-money",
  "senderAccount": "+250..."
}
```

The web treats this as a simulated or backend-recorded payment. On success:

- Refresh bookings.
- Show provider details as unlocked.
- Show QR code if `verificationToken` exists.
- Show receipt links.

Receipt and QR URLs:

```text
GET /api/receipt/:verificationToken
GET /api/receipt/:verificationToken?print=1
GET /api/qr/:verificationToken
GET /api/verify/:verificationToken
```

Mobile behavior:

- Open receipt PDF in an in-app browser or download/share view.
- Display QR image inside the app.
- Add a verification screen that calls `/api/verify/:token`.

Provider details should remain locked until deposit is paid. Web considers deposit paid when statuses include:

```js
["deposit_paid", "deposit-paid", "paid"]
```

Payable booking statuses:

```js
["confirmed", "waiting-for-payment"]
```

## 9. Customer Dashboard

Frontend source: `src/pages/UserDashboard.jsx`

Load customer bookings:

```http
GET /api/bookings/my
```

Requires bearer token.

Customer dashboard should show:

- Confirmed bookings count.
- Pending bookings count.
- Completed bookings count.
- Booking list with status.
- Pay deposit button when payable.
- Provider details only after deposit.
- QR code and receipt after payment.
- Re-book/cancel request button after deposit.

Customer can create a change request:

```http
POST /api/rebook/request
```

Payload:

```json
{
  "originalBookingId": "booking-id",
  "requestType": "rebook",
  "reason": "Customer explanation"
}
```

`requestType` can be:

```js
"rebook" | "cancel"
```

Customer can list their requests:

```http
GET /api/rebook/customer?page=1
```

## 10. Provider Dashboard

Frontend sources: `src/pages/SellerDashboard.jsx`, `src/pages/HotelDashboard.jsx`

Provider roles are `hotel` and `supplier`.

Provider dashboard loads:

```http
GET /api/hotel/overview
GET /api/hotel/services
GET /api/hotel/bookings
GET /api/marketplace-settings
```

### Provider Service Form

Create service:

```http
POST /api/hotel/services
```

Update service:

```http
PUT /api/hotel/services/:serviceId
```

Delete service:

```http
DELETE /api/hotel/services/:serviceId
```

Upload up to 3 images:

```http
POST /api/hotel/uploads/images
```

Multipart field:

```text
images
```

Each image must be an image file, maximum 5 MB, and only the first 3 accepted files are used.

Service payload shape:

```json
{
  "title": "Business listing title",
  "description": "Description",
  "serviceLocation": {
    "country": "Rwanda",
    "province": "",
    "district": "",
    "sector": "",
    "cell": "",
    "village": "",
    "fullAddress": "",
    "latitude": null,
    "longitude": null,
    "locationSource": "map_click",
    "isExactLocationVerified": false
  },
  "locationDetails": {
    "province": "",
    "district": "",
    "sector": "",
    "cell": "",
    "village": ""
  },
  "payoutDetails": {
    "method": "mobile-money",
    "accountName": "",
    "accountNumber": "",
    "instructions": ""
  },
  "contactDetails": {
    "phone": "",
    "whatsapp": ""
  },
  "serviceType": "rental",
  "category": "hotel-rooms",
  "pricing": {
    "amount": 0,
    "unit": "service",
    "currency": "RWF"
  },
  "priceText": "",
  "availableQuantity": 1,
  "availabilityText": "",
  "status": "available",
  "images": [],
  "promotion": {
    "enabled": false,
    "title": "",
    "percent": "",
    "note": "",
    "startAt": "",
    "endAt": ""
  },
  "rebookSettings": {
    "requestDeadlineHours": 24,
    "rebookIdValidityHours": 72
  },
  "availabilityTable": {
    "columns": [],
    "rows": []
  },
  "bookingForm": {
    "title": "Booking Request",
    "description": "",
    "isPublished": true,
    "fields": []
  },
  "isActive": true
}
```

Before changing a service to available, web requires:

- Exact location.
- Payout account.
- At least one service/price row.

Mobile should enforce the same quality gate.

### Provider Custom Booking Forms

Providers build custom form questions inside each service.

Supported field types:

```js
text
textarea
number
email
tel
date
time
datetime-local
select
radio
checkbox
file
url
```

Each field can have:

```json
{
  "id": "field_id",
  "type": "text",
  "label": "Question",
  "placeholder": "",
  "helpText": "",
  "defaultValue": "",
  "required": true,
  "enabled": true,
  "options": [],
  "validation": {
    "min": 1,
    "max": 10,
    "pattern": "",
    "maxFileSizeMb": 5,
    "acceptedFileTypes": "image/*,.pdf"
  }
}
```

Mobile booking forms must render these dynamic fields and include answers in `bookingDetails.customResponses`.

For file fields, the current web booking form stores only metadata in `customResponses`; it does not upload booking-form files. If mobile needs real customer file uploads, confirm or add backend support first.

### Provider Booking Management

Update booking status:

```http
PUT /api/hotel/bookings/:bookingId/status
```

Payload can be simple:

```json
{
  "status": "confirmed"
}
```

Or approval-style, depending on backend support:

```json
{
  "status": "confirmed",
  "totalPrice": 50000,
  "paymentReason": "Approved booking deposit"
}
```

Provider verification:

```http
POST /api/seller/bookings/verify-code
```

Payload:

```json
{
  "code": "BOOKING-CODE"
}
```

Complete a verified booking:

```http
POST /api/seller/bookings/complete-verified
```

Payload is built from the verified booking flow and should include the booking/code details expected by the backend.

Provider can also verify by token:

```http
GET /api/hotel/booking-verification/:lookup
```

### Provider Re-book Requests

List provider requests:

```http
GET /api/rebook/seller?page=1
```

Confirm unavailable:

```http
POST /api/rebook/:id/confirm-unavailable
```

Provider should see only requests for their own services.

## 11. Admin Dashboard

Frontend source: `src/pages/AdminDashboard.jsx`

Admin role is `admin`.

Admin dashboard loads:

```http
GET /api/admin/dashboard-stats
GET /api/admin/businesses
GET /api/admin/services
GET /api/admin/bookings
GET /api/admin/users
GET /api/admin/transactions
GET /api/announcement
GET /api/marketplace-settings
```

### Business Review

Approve or reject a business:

```http
PUT /api/admin/businesses/:businessId/approval
```

Approve payload:

```json
{
  "status": "approved",
  "commissionPercentage": 10
}
```

Reject payload:

```json
{
  "status": "rejected"
}
```

Delete business:

```http
DELETE /api/admin/businesses/:businessId
```

### Booking Approval

Approve booking:

```http
PUT /api/admin/bookings/:bookingId/approve
```

Payload:

```json
{
  "businessId": "business-id",
  "totalPrice": 50000,
  "commissionPercentage": 10,
  "paymentReason": "Approved booking deposit"
}
```

Reject booking:

```http
PUT /api/admin/bookings/:bookingId/reject
```

Payload:

```json
{
  "reason": "Reason shown to customer"
}
```

### Marketplace Settings

Update settings:

```http
PUT /api/admin/marketplace-settings
```

Payload:

```json
{
  "defaultCommissionPercentage": 10,
  "bookingMode": "manual",
  "bookingRules": ["Rule text"]
}
```

Booking mode values used by web:

```js
"manual"
"automatic"
"service-level"
```

Update a single service booking mode:

```http
PUT /api/admin/businesses/:businessId/booking-mode
```

Payload:

```json
{
  "bookingMode": "automatic"
}
```

### Create Provider

```http
POST /api/admin/sellers
```

Payload:

```json
{
  "providerName": "Provider Name",
  "providerEmail": "provider@example.com"
}
```

The response can include onboarding credentials and email delivery status. Mobile admin should show these clearly so admin can copy/share them if email delivery fails.

### Announcement

```http
PUT /api/admin/announcement
```

Payload:

```json
{
  "enabled": true,
  "intervalSeconds": 5,
  "items": [
    {
      "text": "Announcement",
      "linkUrl": "",
      "linkLabel": ""
    }
  ]
}
```

### Users

Delete one user:

```http
DELETE /api/admin/users/:userId
```

Delete many users:

```http
DELETE /api/admin/users/bulk
```

Payload:

```json
{
  "userIds": ["id1", "id2"]
}
```

### Revenue and Commission

Transactions:

```http
GET /api/admin/transactions?page=1&limit=25&from=&to=&status=
```

Mark commission collected:

```http
PUT /api/admin/transactions/:transactionId/commission
```

Payload:

```json
{
  "commissionStatus": "collected"
}
```

### Admin Re-book and Refund Management

List:

```http
GET /api/rebook/admin?page=1&status=
```

Approve:

```http
POST /api/rebook/:id/approve
```

Reject:

```http
POST /api/rebook/:id/reject
```

Payload:

```json
{
  "reason": "Reason"
}
```

Approve refund:

```http
POST /api/rebook/:id/refund
```

Mark seller notified:

```http
POST /api/rebook/:id/mark-seller-notified
```

## 12. Realtime Integration

Frontend source: `src/lib/realtime.js`

The web uses Socket.IO:

```js
io(API_BASE_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800
})
```

Events:

```js
catalog:changed
hotel:changed
service:changed
room:changed
booking:changed
notification:new
```

Rooms/channels are joined with:

```js
socket.emit(`${room}:join`, id)
```

Used rooms:

- `user`, with user ID.
- `business`, with provider business/hotel ID.
- `admin`, with `marketplace`.

Mobile should subscribe to the same events:

- Catalog screens refresh on catalog/service/hotel/room changes.
- Customer bookings refresh on `booking:changed`.
- Provider dashboard refreshes on service and booking changes.
- Admin dashboard refreshes on business, service, and booking changes.

If realtime is not connected, the app must still work with manual refresh and screen-focus refetch.

## 13. Analytics

Frontend source: `src/lib/analytics.js`

Endpoint:

```http
POST /api/analytics/track
```

Payload:

```json
{
  "eventType": "APP_VISIT",
  "sessionId": "session-id",
  "pageUrl": "/mobile/screen-or-route",
  "serviceId": "optional",
  "bookingId": "optional",
  "paymentId": "optional"
}
```

Events used:

```js
APP_VISIT
SERVICE_VIEW
BOOKING_FORM_OPENED
BOOKING_SUBMITTED
PAY_DEPOSIT_CLICKED
PAYMENT_SUCCESS
PAYMENT_FAILED
```

Mobile should create one session ID per app session and send equivalent route names in `pageUrl`.

## 14. Mobile Navigation Map

Recommended mobile screens:

- Public home/catalog.
- Services list/search/filter.
- Service detail.
- Login.
- Register customer.
- Verify email.
- Forgot password.
- Reset password.
- Complete provider registration.
- Customer dashboard.
- Booking detail.
- Booking form.
- Deposit payment.
- Receipt/QR viewer.
- Change request form.
- Provider dashboard.
- Provider service form.
- Provider booking detail.
- Provider booking verification.
- Provider re-book requests.
- Admin dashboard.
- Admin business review.
- Admin booking review.
- Admin users.
- Admin providers.
- Admin marketplace settings.
- Admin re-book/refund requests.
- Admin revenue/transactions.

## 15. Mobile Implementation Checklist

Auth:

- Implement secure token storage.
- Restore user on app launch.
- Clear auth if user is missing or email is not verified.
- Route by role after login/register/verification.
- Add logout that clears local auth.

API:

- Mirror `src/lib/api.js` endpoint groups.
- Preserve backend error `message`, `code`, and status.
- Add multipart upload support for provider service images.
- Use production backend URL.

Customer:

- Build catalog and service detail from `/api/hotels`.
- Reuse frontend normalization rules.
- Build the booking form with fixed fields and provider custom fields.
- Support manual and automatic booking.
- Support re-book ID verification.
- Support deposit payment.
- Lock provider details until deposit.
- Display receipt PDF, QR image, and verification result.
- Support re-book/cancel requests.

Provider:

- Load overview, services, and bookings.
- Create/update/delete services.
- Upload up to 3 service images.
- Support exact service location, payout details, availability table, promotion, re-book settings, and custom booking form builder.
- Approve/update bookings.
- Verify customer booking code/token.
- Manage re-book requests.

Admin:

- Load stats, businesses, services, bookings, users, transactions, announcement, and settings.
- Review businesses with commission percentage.
- Approve/reject bookings.
- Create providers.
- Manage marketplace booking mode and booking rules.
- Manage announcements.
- Manage users.
- Manage commission status.
- Manage re-book/cancel/refund requests.

Realtime:

- Connect with Socket.IO.
- Join user/business/admin rooms.
- Refresh affected screens on events.
- Add pull-to-refresh and focus refetch as fallback.

Quality:

- Validate forms before API calls.
- Show loading and disabled states during submit.
- Show backend error messages.
- Prevent duplicate submissions.
- Handle offline/network failures gracefully.
- Test every role with a clean installed app and an existing account.

## 16. Known Web Integration Notes to Confirm Before Mobile Build

These items should be confirmed with the backend while implementing mobile:

- Public business registration currently calls `authApi.registerBusiness`, but `src/lib/api.js` defines `registerBusiness` under `adminApi` and requires a token. Confirm the intended public provider signup endpoint.
- Booking-form `file` custom fields currently send file metadata only, not uploaded files. Confirm whether mobile must upload actual customer files.
- Payment appears to be backend-recorded/simulated from the frontend payload. Confirm production payment gateway behavior before releasing mobile payments.
- `src/lib/api.js` defaults to `http://localhost:5000`, while `src/lib/realtime.js` defaults to `https://umuhuzaback.onrender.com`. Mobile should use one confirmed production backend URL for both HTTP and Socket.IO.

## 17. Recommended Mobile API Module Shape

Keep mobile code organized like this:

```text
api/
  client.ts
  auth.ts
  public.ts
  bookings.ts
  provider.ts
  admin.ts
  rebook.ts
  analytics.ts
  realtime.ts
storage/
  authStorage.ts
navigation/
  roleRoutes.ts
features/
  auth/
  catalog/
  booking/
  customer/
  provider/
  admin/
```

This keeps the mobile app aligned with the working web frontend while still feeling native and professional.
