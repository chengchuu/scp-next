#!/bin/bash
set -e

echo "Installing dependencies ..."
npm install

echo "Starting webpack server mode ..."
npm run dev
