# Go Dutch (iOS)

The mobile client and backend for **Go Dutch**, an app for splitting restaurant bills with friends.

This repo holds the receipt-scanning pipeline:

1. Photograph a receipt.
2. A vision model turns it into structured line items, tax, tip and totals.
3. The result is saved to your account, ready to split.

## What it does

- **Capture.** Take a photo or pick one from your library, from the Expo app.
- **Parse.** A Firebase Cloud Function sends the image to Google Gemini at temperature 0, with a prompt written for real-world receipts:
  - multilingual item names, kept whole (for example `2. 冰沙草莓得其利 Strawberry Daiquiri`), without mistaking numbers inside a name for quantities
  - add-ons folded into their parent item's price
  - customer copies with handwritten totals or a missing tip, without inventing values
  - currency inferred from symbols or location
- **Store.** Authenticated endpoints save, load and update receipts in MongoDB.

Output schema: `meta_data` (restaurant, address, times, guest count), `items[]` (name, quantity, total), and `payment` (subtotal, tax, tip, total, currency).

## Architecture

```
Expo / React Native app ──(Firebase Auth ID token)──► Firebase Cloud Functions
                                                        ├── processReceipt ──► Gemini (vision → JSON)
                                                        ├── saveReceipt
                                                        ├── loadReceiptById ──► MongoDB (receipts)
                                                        └── updateReceiptById
```

**Stack:** React Native (Expo Router, TypeScript), Firebase Auth and Cloud Functions (Node.js), Google Gemini API, MongoDB.

## Run it

```bash
npm install
npx expo start                 # app (iOS simulator, device, or web)

cd functions && npm install    # backend
firebase emulators:start --only functions
```

The functions read `GEMINI_API_KEY` and `MONGODB_URI` from the environment.

## Layout

- `app/(tabs)/receipt.tsx`: capture, parse, review and save screen
- `app/services/`: API client and auth helpers
- `app/contexts/AuthContext.tsx`: Firebase auth state
- `functions/src/`: the four Cloud Functions
- `functions/lib/`: auth token verification and MongoDB access

## Team

Built by Mina Wang and Yiheng Zhu.
