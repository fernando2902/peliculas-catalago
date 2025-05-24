// IndexedDB setup
const dbName = 'MovieCatalogDB';
const dbVersion = 1;
let db;

const request = indexedDB.open(dbName, dbVersion);

request.onerror = (event) => {
    console.error('Error opening database:', event.target.error);
    alert('Error al abrir la base de datos. Por favor, recarga la página.');
};

request.onsuccess = (event) => {
    console.log('Base de datos abierta exitosamente');
    db = event.target.result;
    loadMovies();
    populateYearFilter();
};

request.onupgradeneeded = (event) => {
    console.log('Actualizando base de datos...');
    const db = event.target.result;
    if (!db.objectStoreNames.contains('movies')) {
        const store = db.createObjectStore('movies', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('genre', 'genre', { unique: false });
        store.createIndex('year', 'releaseYear', { unique: false });
        store.createIndex('quality', 'quality', { unique: false });
        console.log('Base de datos actualizada correctamente');
    }
};

// DOM Elements
const movieForm = document.getElementById('movieForm');
const coverImageInput = document.getElementById('coverImage');
const imagePreview = document.getElementById('imagePreview');
const moviesList = document.getElementById('moviesList');
const catalogGrid = document.getElementById('catalogGrid');
const movieModal = document.getElementById('movieModal');
const modalContent = document.getElementById('modalContent');
const closeModalBtn = document.querySelector('.close');
const btnRegistro = document.getElementById('btnRegistro');
const btnCatalogo = document.getElementById('btnCatalogo');
const registroSection = document.getElementById('registro');
const catalogoSection = document.getElementById('catalogo');
const searchInput = document.getElementById('searchInput');
const genreFilter = document.getElementById('genreFilter');
const qualityFilter = document.getElementById('qualityFilter');
const yearFilter = document.getElementById('yearFilter');
const sortBy = document.getElementById('sortBy');
const exportCatalog = document.getElementById('exportCatalog');
const importCatalog = document.getElementById('importCatalog');
const importFile = document.getElementById('importFile');

// Navigation
btnRegistro.addEventListener('click', () => {
    registroSection.classList.add('active');
    catalogoSection.classList.remove('active');
    btnRegistro.classList.add('active');
    btnCatalogo.classList.remove('active');
});

btnCatalogo.addEventListener('click', () => {
    catalogoSection.classList.add('active');
    registroSection.classList.remove('active');
    btnCatalogo.classList.add('active');
    btnRegistro.classList.remove('active');
    loadCatalog();
});

// Image Preview and Compression
coverImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const compressedImage = await compressImage(file);
        imagePreview.innerHTML = `<img src="${compressedImage}" alt="Preview">`;
    }
});

// Compress Image
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate new dimensions (max 800px width/height)
                let width = img.width;
                let height = img.height;
                const maxSize = 800;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Form Submission
movieForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Enviando formulario...');
    
    // Obtener géneros seleccionados
    const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked'))
        .map(checkbox => checkbox.value);

    if (selectedGenres.length === 0) {
        alert('Por favor, selecciona al menos un género');
        return;
    }
    
    const movieData = {
        name: document.getElementById('movieName').value,
        description: document.getElementById('description').value,
        genres: selectedGenres,
        trailer: document.getElementById('trailer').value,
        releaseYear: document.getElementById('releaseYear').value,
        quality: document.getElementById('quality').value,
        isNewRelease: document.getElementById('isNewRelease').checked,
        coverImage: imagePreview.querySelector('img')?.src || '',
        dateAdded: new Date().toISOString()
    };

    console.log('Datos de la película:', movieData);

    try {
        await saveMovie(movieData);
        console.log('Película guardada exitosamente');
        alert('Película guardada exitosamente');
        movieForm.reset();
        imagePreview.innerHTML = '';
        loadMovies();
        populateYearFilter();
    } catch (error) {
        console.error('Error al guardar la película:', error);
        alert('Error al guardar la película. Por favor, intenta de nuevo.');
    }
});

// Save Movie to IndexedDB
async function saveMovie(movieData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['movies'], 'readwrite');
        const store = transaction.objectStore('movies');
        const request = store.add(movieData);

        request.onsuccess = () => {
            console.log('Película guardada en la base de datos');
            resolve();
        };
        
        request.onerror = () => {
            console.error('Error al guardar en la base de datos:', request.error);
            reject(request.error);
        };
    });
}

// Load Movies for Registration Section
async function loadMovies() {
    console.log('Cargando películas...');
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    const request = store.getAll();

    request.onsuccess = () => {
        const movies = request.result;
        console.log('Películas cargadas:', movies);
        
        if (movies.length === 0) {
            moviesList.innerHTML = '<p>No hay películas registradas</p>';
            return;
        }
        
        moviesList.innerHTML = movies.map(movie => `
            <div class="movie-item">
                <img src="${movie.coverImage || ''}" alt="${movie.name || 'Sin título'}" onclick="showMovieDetails(${movie.id})">
                <h4>${movie.name || 'Sin título'}</h4>
                <p>${(movie.genres || []).join(', ')} (${movie.releaseYear || 'N/A'})</p>
                <div class="movie-actions">
                    <button class="edit-btn" onclick="editMovie(${movie.id})">Editar</button>
                    <button class="delete-btn" onclick="deleteMovie(${movie.id})">Eliminar</button>
                </div>
            </div>
        `).join('');
    };

    request.onerror = () => {
        console.error('Error al cargar las películas');
        moviesList.innerHTML = '<p>Error al cargar las películas</p>';
    };
}

// Load Catalog with Filters
async function loadCatalog() {
    console.log('Cargando catálogo...');
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    const request = store.getAll();

    request.onsuccess = () => {
        const movies = request.result;
        console.log('Películas encontradas:', movies);

        if (movies.length === 0) {
            catalogGrid.innerHTML = '<p class="no-movies">No hay películas en el catálogo</p>';
            return;
        }

        // Apply filters
        const searchTerm = searchInput.value.toLowerCase();
        const selectedGenre = genreFilter.value;
        const selectedQuality = qualityFilter.value;
        const selectedYear = yearFilter.value;

        const filteredMovies = movies.filter(movie => {
            const matchesSearch = movie.name.toLowerCase().includes(searchTerm);
            const matchesGenre = !selectedGenre || (movie.genres && movie.genres.includes(selectedGenre));
            const matchesQuality = !selectedQuality || movie.quality === selectedQuality;
            const matchesYear = !selectedYear || movie.releaseYear === selectedYear;
            return matchesSearch && matchesGenre && matchesQuality && matchesYear;
        });

        console.log('Películas filtradas:', filteredMovies);

        if (filteredMovies.length === 0) {
            catalogGrid.innerHTML = '<p class="no-movies">No se encontraron películas con los filtros seleccionados</p>';
            return;
        }

        catalogGrid.innerHTML = filteredMovies.map(movie => `
            <div class="movie-card ${movie.isNewRelease ? 'new-release' : 'regular'}" onclick="showMovieDetails(${movie.id})">
                <img src="${movie.coverImage || ''}" alt="${movie.name || 'Sin título'}">
                <div class="quality-badge">${movie.quality || 'N/A'}</div>
                ${movie.isNewRelease ? '<div class="new-release-badge">Estreno</div>' : ''}
            </div>
        `).join('');
    };

    request.onerror = () => {
        console.error('Error al cargar el catálogo');
        catalogGrid.innerHTML = '<p class="error-message">Error al cargar el catálogo</p>';
    };
}

// Populate Year Filter
async function populateYearFilter() {
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    const request = store.getAll();

    request.onsuccess = () => {
        const movies = request.result;
        const years = [...new Set(movies.map(movie => movie.releaseYear))].sort((a, b) => b - a);
        yearFilter.innerHTML = '<option value="">Todos los años</option>' +
            years.map(year => `<option value="${year}">${year}</option>`).join('');
    };
}

// Show Movie Details in Modal
async function showMovieDetails(id) {
    try {
        const transaction = db.transaction(['movies'], 'readonly');
        const store = transaction.objectStore('movies');
        const request = store.get(id);

        request.onsuccess = () => {
            const movie = request.result;
            if (!movie) {
                console.error('Película no encontrada');
                return;
            }

            const videoId = getVideoId(movie.trailer);
            
            modalContent.innerHTML = `
                <div class="movie-details">
                    <div class="movie-info">
                        <h2>${movie.name || 'Sin título'}</h2>
                        <p class="movie-description">${movie.description || 'Sin descripción disponible'}</p>
                        ${videoId ? `
                            <div class="trailer-container">
                                <iframe 
                                    src="https://www.youtube.com/embed/${videoId}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            movieModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        };

        request.onerror = () => {
            console.error('Error al obtener los detalles de la película');
        };
    } catch (error) {
        console.error('Error al mostrar detalles:', error);
    }
}

// Get YouTube Video ID
function getVideoId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Close Modal
function closeMovieModal() {
    movieModal.style.display = 'none';
    document.body.style.overflow = ''; // Restaurar scroll del body
}

closeModalBtn.addEventListener('click', closeMovieModal);

// Cerrar modal al hacer clic fuera del contenido
movieModal.addEventListener('click', (e) => {
    if (e.target === movieModal) {
        closeMovieModal();
    }
});

// Cerrar modal con la tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && movieModal.style.display === 'block') {
        closeMovieModal();
    }
});

// Edit Movie
async function editMovie(id) {
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    const request = store.get(id);

    request.onsuccess = () => {
        const movie = request.result;
        document.getElementById('movieName').value = movie.name;
        document.getElementById('description').value = movie.description;
        
        // Desmarcar todos los checkboxes primero
        document.querySelectorAll('input[name="genre"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Marcar los géneros de la película
        movie.genres.forEach(genre => {
            const checkbox = document.querySelector(`input[name="genre"][value="${genre}"]`);
            if (checkbox) checkbox.checked = true;
        });

        document.getElementById('trailer').value = movie.trailer;
        document.getElementById('releaseYear').value = movie.releaseYear;
        document.getElementById('quality').value = movie.quality;
        document.getElementById('isNewRelease').checked = movie.isNewRelease;
        imagePreview.innerHTML = `<img src="${movie.coverImage}" alt="Preview">`;
        
        // Delete the old movie
        deleteMovie(id);
    };
}

// Delete Movie
async function deleteMovie(id) {
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const request = store.delete(id);

    request.onsuccess = () => {
        loadMovies();
        loadCatalog();
        populateYearFilter();
    };
}

// Filter Event Listeners
searchInput.addEventListener('input', loadCatalog);
genreFilter.addEventListener('change', loadCatalog);
qualityFilter.addEventListener('change', loadCatalog);
yearFilter.addEventListener('change', loadCatalog);

// Export Catalog
exportCatalog.addEventListener('click', async () => {
    try {
        const transaction = db.transaction(['movies'], 'readonly');
        const store = transaction.objectStore('movies');
        const request = store.getAll();

        request.onsuccess = () => {
            const movies = request.result;
            if (!movies || movies.length === 0) {
                alert('No hay películas para exportar');
                return;
            }
            const blob = new Blob([JSON.stringify(movies, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'catalogo_peliculas.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        request.onerror = () => {
            console.error('Error al exportar el catálogo:', request.error);
            alert('Error al exportar el catálogo');
        };
    } catch (error) {
        console.error('Error al exportar el catálogo:', error);
        alert('Error al exportar el catálogo');
    }
});

// Import Catalog
importCatalog.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const movies = JSON.parse(e.target.result);
                if (!Array.isArray(movies)) {
                    throw new Error('El archivo no contiene un catálogo válido');
                }

                const transaction = db.transaction(['movies'], 'readwrite');
                const store = transaction.objectStore('movies');

                // Clear existing movies
                await new Promise((resolve, reject) => {
                    const clearRequest = store.clear();
                    clearRequest.onsuccess = () => resolve();
                    clearRequest.onerror = () => reject(clearRequest.error);
                });

                // Add imported movies
                for (const movie of movies) {
                    await new Promise((resolve, reject) => {
                        const request = store.add(movie);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }

                loadMovies();
                loadCatalog();
                populateYearFilter();
                alert('Catálogo importado exitosamente');
            } catch (error) {
                console.error('Error importing catalog:', error);
                alert('Error al importar el catálogo: ' + error.message);
            }
        };

        reader.onerror = () => {
            console.error('Error reading file:', reader.error);
            alert('Error al leer el archivo');
        };

        reader.readAsText(file);
    } catch (error) {
        console.error('Error processing file:', error);
        alert('Error al procesar el archivo');
    }
}); 