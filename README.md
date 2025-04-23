# Document Insight Lens

A powerful document comparison and analysis application powered by Claude AI.

## Features

- Upload and analyze multiple document types (PDF, images, CSV, Excel, Word)
- Compare documents and extract key information
- Get AI-powered insights, verification, validation, and recommendations
- View structured comparison tables
- Ask follow-up questions with prompt caching for faster responses
- Export results in various formats
- Reduced AI hallucinations through quote-based analysis and explicit uncertainty
- Consistent, structured output format for reliable results

## Project info

**URL**: https://lovable.dev/projects/b30d0fe7-5460-476b-9a15-b70a4e83dae4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b30d0fe7-5460-476b-9a15-b70a4e83dae4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Create a .env file with your Claude API key
echo "VITE_ANTHROPIC_API_KEY=your-api-key" > .env

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- Claude AI (Anthropic)
- pdf.js
- XLSX
- shadcn-ui
- Tailwind CSS

## Document Types Supported

- PDF files
- Images (JPG, PNG, etc.)
- CSV files
- Excel spreadsheets
- Word documents

## Comparison Types

- General Documents - Compare any type of documents
- Contracts - Focus on parties, terms, financials, and validity dates
- Invoices - Extract invoice numbers, dates, items, quantity, price, taxes, total
- Packing Lists - Focus on items, quantities, weight, packaging type, consignee/consignor, shipment IDs, and dates
- Bills of Entry - Focus on customs details, HS codes, duties, declared goods, shipper/receiver, and regulatory fields
- Resumes - Compare skills, roles, education, relevant dates
- Reports - Compare key findings, sections, metrics

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b30d0fe7-5460-476b-9a15-b70a4e83dae4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
