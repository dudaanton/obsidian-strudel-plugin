#!/bin/bash

source ./.env

# Exit immediately if a command exits with a non-zero status.
set -e

if [ "$1" = "prod" ]; then
  TARGET_DIR="$TARGET_VAULT_DIR"
  echo ">>> Building for PROD vault"
else
  TARGET_DIR="$TARGET_TEST_VAULT_DIR"
  echo ">>> Building for TEST vault"
fi

if [ -z "$TARGET_DIR" ]; then
    echo "Error: Target directory is not defined. Check your .env file."
    exit 1
fi

# Define plugin source and build directories
PLUGIN_DIR="."
BUILD_DIR="$PLUGIN_DIR/build"

echo "--- Building Strudel Obsidian Plugin ---"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Node modules not found. Installing dependencies..."
  npm install
fi

# Run the build script
echo "Running build..."
npm run build

echo "--- Copying Plugin Files to Test Vault ---"

# Create target directory in test vault if it doesn't exist
mkdir -p "$TARGET_DIR"
echo "Ensured target directory exists: $TARGET_DIR"

# Copy built files
cp -X "$BUILD_DIR/main.js" "$TARGET_DIR/main.js"
echo "Copied main.js"

cp -X "$BUILD_DIR/styles.css" "$TARGET_DIR/styles.css"
echo "Copied styles.css"

cp -X "$PLUGIN_DIR/manifest.json" "$TARGET_DIR/manifest.json"
echo "Copied manifest.json"

echo "--- Plugin Build and Copy Complete ---"
echo "Plugin files are ready in: $TARGET_DIR"

