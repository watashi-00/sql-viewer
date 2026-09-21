export const SEED_MOVIES_SQL = `
CREATE TABLE directors (
  director_id INTEGER PRIMARY KEY,
  name VARCHAR,
  nationality VARCHAR,
  birth_year INTEGER
);

INSERT INTO directors VALUES
  (1, 'Christopher Nolan', 'British', 1970),
  (2, 'Quentin Tarantino', 'American', 1963),
  (3, 'Greta Gerwig', 'American', 1983);

CREATE TABLE movies (
  movie_id INTEGER PRIMARY KEY,
  title VARCHAR,
  genre VARCHAR,
  year INTEGER,
  director_id INTEGER,
  budget INTEGER,
  revenue INTEGER,
  runtime INTEGER
);

INSERT INTO movies VALUES
  (1, 'Inception', 'Sci-Fi', 2010, 1, 160000000, 829895144, 148),
  (2, 'Interstellar', 'Sci-Fi', 2014, 1, 165000000, 677471339, 169),
  (3, 'Pulp Fiction', 'Crime', 1994, 2, 8000000, 213928762, 154),
  (4, 'Barbie', 'Comedy', 2023, 3, 145000000, 1445638421, 114),
  (5, 'Oppenheimer', 'Biography', 2023, 1, 100000000, 957000000, 180);

CREATE TABLE reviews (
  review_id INTEGER PRIMARY KEY,
  movie_id INTEGER,
  score INTEGER,
  platform VARCHAR,
  review_year INTEGER
);

INSERT INTO reviews VALUES
  (1, 1, 9, 'IMDb', 2023),
  (2, 1, 8, 'Rotten Tomatoes', 2023),
  (3, 2, 9, 'IMDb', 2023),
  (4, 2, 7, 'Letterboxd', 2024),
  (5, 3, 9, 'IMDb', 2022),
  (6, 4, 8, 'IMDb', 2023),
  (7, 5, 10, 'IMDb', 2023),
  (8, 5, 9, 'Rotten Tomatoes', 2023);
`;
