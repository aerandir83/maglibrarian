# Contributing

Thank you for considering contributing to AutoLibrarian!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/autolibrarian.git
   cd autolibrarian
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Running Tests

We use `pytest` for testing.

1. **Run all tests:**
   ```bash
   pytest
   ```

2. **Run specific tests:**
   ```bash
   pytest tests/test_identifier.py
   ```

## Coding Standards

- Follow PEP 8 style guidelines.
- Ensure new features have corresponding tests.
- Add type hints where possible.

## Project Structure

- `src/`: Source code.
- `tests/`: Unit tests.
- `docs/`: Documentation.
