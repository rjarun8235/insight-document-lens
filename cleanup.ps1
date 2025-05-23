# Cleanup script for DocLens project

# Keep only the essential files for our new document upload page

# 1. Remove old components except DocumentUpload.tsx and UI components
Get-ChildItem -Path "src\components" -File | Where-Object { $_.Name -ne "DocumentUpload.tsx" } | Remove-Item -Force

# 2. Remove document-processing folder
Remove-Item -Path "src\components\document-processing" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Remove services folder
Remove-Item -Path "src\services" -Recurse -Force -ErrorAction SilentlyContinue

# 4. Remove old pages except HomePage.tsx and NotFound.tsx
Get-ChildItem -Path "src\pages" -File | Where-Object { $_.Name -ne "HomePage.tsx" -and $_.Name -ne "NotFound.tsx" } | Remove-Item -Force

# 5. Remove archived folder if it exists
Remove-Item -Path "src\archived" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cleanup completed successfully!" -ForegroundColor Green
