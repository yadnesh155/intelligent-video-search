# Intelligent Semantic Video Search & Content Indexing Engine

A full-stack application that uses AI to index video content and
retrieve relevant scenes through natural-language search.

## Features

- Upload videos through a React interface.
- Extract video frames using FFmpeg.
- Generate frame descriptions using Ollama and LLaVA.
- Generate text embeddings for semantic retrieval.
- Store video metadata, frame descriptions, and embeddings in MongoDB.
- Search using natural-language queries and MongoDB Vector Search.
- Jump to relevant timestamps using an HTML5 video player.
- Track processing progress in a video library.
- Resume unfinished processing while preserving completed frames.
- Retry failed frames and delete videos with associated assets.

## Technology Stack

**Frontend:** React, Vite, Tailwind CSS

**Backend:** Node.js, Express.js

**AI:** Ollama, LLaVA, EmbeddingGemma

**Database and Search:** MongoDB Atlas, MongoDB Vector Search

**Video Processing:** FFmpeg

## Prerequisites

- Node.js and npm
- FFmpeg installed and available on PATH
- Ollama installed with the required models
- A MongoDB Atlas database with a configured vector search index

## Local Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd intelligent-video-search