# Phase 1 — Foundation & Local Development Setup

**Project:** YouTube Prep Interview — AI Study Agent  
**Date:** October 8–9, 2026  
**Status:** In Progress

## Technology Stack

| Technology | Version | Purpose | Why We Chose It |
|---|---|---|---|
| Next.js |  | Structured React application with file-based routing. |
| TypeScript | Configured | Frontend language | Type safety and maintainable code. |
| Tailwind CSS | Configured;  | Styling | Rapid, consistent UI development. |
| Python |  | Backend language | AI/ML ecosystem and Python-based AI tooling. |
| FastAPI |  | Backend API | Typed endpoints, validation, and automatic API documentation. |
| Uvicorn |  | ASGI server | Runs the FastAPI application. |
| PostgreSQL | 17.11; Docker image `postgres:17` | Database | Reliable relational storage for videos, transcripts, notes, and questions. |
| SQLAlchemy | 2.0 or later; exact version to verify | ORM and SQL toolkit | Database queries, connection pooling, and session management. |
| Psycopg | Psycopg 3; exact version to verify | PostgreSQL driver | Enables Python to communicate with PostgreSQL. |

| Redis | Docker image `redis:8` | In-memory data store | Infrastructure for future background-job queuing with Celery. |
| Docker | 29.5.3 | Container runtime | Runs infrastructure without installing databases directly on the host. |
| Docker Compose | v5.1.4 | Infrastructure orchestration | Manages PostgreSQL and Redis through one configuration. |


## Architecture Decisions

- **Separate frontend and backend:** Next.js handles the UI; FastAPI handles API requests and future AI workflows.
- **Dockerized infrastructure:** PostgreSQL and Redis run in containers, while Next.js and FastAPI run locally during development.
- **SQLAlchemy + Psycopg:** SQLAlchemy manages database operations; Psycopg provides PostgreSQL connectivity.
- **Centralized configuration:** `.env` stores local configuration, while `.env.example` documents required variables. The root `.gitignore` excludes local secrets and generated files.
- **Incremental development:** Each component is implemented and verified before introducing the next.



## Scope Boundaries

YouTube ingestion, transcript extraction, LLM integration, knowledge processing, notes and questions generation, LangGraph, Celery workers, RAG, and deployment are intentionally deferred to later phases.
