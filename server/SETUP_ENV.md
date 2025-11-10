# Setting Up Server Environment Variables

## Quick Setup

### Step 1: Get Your DATABASE_URL from Replit

1. Go to **https://replit.com**
2. Open your **FreightFlow** project
3. Click **Tools** → **Secrets** (🔒 lock icon)
4. Find and **copy** the `DATABASE_URL` value

### Step 2: Generate SESSION_SECRET

Run this command in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (it will be a long random string).

### Step 3: Create .env File

In the `server` folder, create a file named `.env` (no extension) with this content:

```env
DATABASE_URL=your_replit_database_url_paste_here
SESSION_SECRET=your_generated_secret_paste_here
NODE_ENV=development
PORT=5000
```

**Example:**
```env
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
NODE_ENV=development
PORT=5000
```

### Step 4: Verify

Make sure your `.env` file is in the `server` folder:
```
FreightFlow1/
└── server/
    ├── .env          ← This file should exist here
    ├── index.ts
    └── ...
```

## Using PowerShell to Create the File

```powershell
cd server

# Create .env file
@"
DATABASE_URL=your_database_url_here
SESSION_SECRET=your_secret_here
NODE_ENV=development
PORT=5000
"@ | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
```

Then edit the file and replace the placeholder values.

## Troubleshooting

**Error: "DATABASE_URL must be set"**
- Make sure the `.env` file exists in the `server` folder
- Check that the file is named exactly `.env` (not `.env.txt`)
- Verify the DATABASE_URL line doesn't have quotes around it
- Make sure there are no extra spaces

**File not found?**
- The `.env` file might be hidden (starts with a dot)
- In PowerShell, use: `Get-ChildItem -Force` to see hidden files
- Or use: `ls -Force` in PowerShell

## Next Steps

After creating the `.env` file:
```powershell
cd server
npm run dev
```

The server should now start successfully! 🎉

