// IndexedDB setup
const dbName = 'MovieCatalogDB';
const dbVersion = 1;
let db;

const request = indexedDB.open(dbName, dbVersion);

request.onerror = (event) => {
    console.error('Error al abrir la base de datos:', event.target.error);
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
const releaseFilter = document.getElementById('releaseFilter');
const viewsFilter = document.getElementById('viewsFilter');
const sortBy = document.getElementById('sortBy');
const exportCatalog = document.getElementById('exportCatalog');
const importCatalog = document.getElementById('importCatalog');
const importFile = document.getElementById('importFile');
const shareWhatsApp = document.getElementById('shareWhatsApp');
const generateHtmlCatalog = document.getElementById('generateHtmlCatalog');

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
        releaseYear: document.getElementById('year').value,
        quality: document.getElementById('quality').value,
        isNewRelease: document.getElementById('isNewRelease').checked,
        coverImage: imagePreview.querySelector('img')?.src || '',
        dateAdded: new Date().toISOString(),
        views: 0
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
        const selectedRelease = releaseFilter.value;
        const selectedViews = viewsFilter.value;

        let filteredMovies = movies.filter(movie => {
            const matchesSearch = movie.name.toLowerCase().includes(searchTerm);
            const matchesGenre = !selectedGenre || (movie.genres && movie.genres.includes(selectedGenre));
            const matchesQuality = !selectedQuality || movie.quality === selectedQuality;
            const matchesYear = !selectedYear || movie.releaseYear === selectedYear;
            const matchesRelease = !selectedRelease || movie.isNewRelease === (selectedRelease === 'true');
            return matchesSearch && matchesGenre && matchesQuality && matchesYear && matchesRelease;
        });

        // Ordenar por vistas si se seleccionó
        if (selectedViews) {
            filteredMovies.sort((a, b) => {
                const viewsA = a.views || 0;
                const viewsB = b.views || 0;
                return selectedViews === 'most' ? viewsB - viewsA : viewsA - viewsB;
        });
        }

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
                <div class="views-badge">👁️ ${movie.views || 0}</div>
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
        const transaction = db.transaction(['movies'], 'readwrite');
        const store = transaction.objectStore('movies');
        const request = store.get(id);

        request.onsuccess = () => {
            const movie = request.result;
            if (!movie) {
                console.error('Película no encontrada');
                return;
            }

            // Incrementar el contador de visualizaciones
            movie.views = (movie.views || 0) + 1;
            store.put(movie);

            const videoId = getVideoId(movie.trailer);
            
            modalContent.innerHTML = `
                <div class="movie-details">
                    <div class="movie-info">
                        <h2>${movie.name || 'Sin título'}</h2>
                        <p class="movie-description">${movie.description || 'Sin descripción disponible'}</p>
                        <p class="movie-views">Visualizaciones: ${movie.views || 0}</p>
                        <div class="movie-meta">
                            <p>🎭 Géneros: ${movie.genres.join(', ')}</p>
                            <p>📅 Año: ${movie.releaseYear}</p>
                            <p>🎥 Calidad: ${movie.quality}</p>
                            ${movie.isNewRelease ? '<p>⭐ ESTRENO</p>' : ''}
                        </div>
                        <button class="share-whatsapp-btn" onclick="shareMovieWhatsApp(${movie.id})">
                            <i class="whatsapp-icon">📱</i> Compartir por WhatsApp
                        </button>
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
        document.getElementById('year').value = movie.releaseYear;
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
releaseFilter.addEventListener('change', loadCatalog);
viewsFilter.addEventListener('change', loadCatalog);

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

                // Limpiar películas existentes
                await new Promise((resolve, reject) => {
                    const clearRequest = store.clear();
                    clearRequest.onsuccess = () => resolve();
                    clearRequest.onerror = () => reject(clearRequest.error);
                });

                // Agregar películas importadas
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
                console.error('Error al importar el catálogo:', error);
                alert('Error al importar el catálogo: ' + error.message);
            }
        };

        reader.onerror = () => {
            console.error('Error al leer el archivo:', reader.error);
            alert('Error al leer el archivo');
        };

        reader.readAsText(file);
    } catch (error) {
        console.error('Error al procesar el archivo:', error);
        alert('Error al procesar el archivo');
    }
});

// Share Single Movie via WhatsApp
async function shareMovieWhatsApp(id) {
    try {
        const transaction = db.transaction(['movies'], 'readonly');
        const store = transaction.objectStore('movies');
        const request = store.get(id);

        request.onsuccess = () => {
            const movie = request.result;
            if (!movie) {
                alert('Película no encontrada');
                return;
            }

            // Crear mensaje con la información de la película
            let message = `🎬 *${movie.name}*\n\n`;
            message += `📝 *Descripción:*\n${movie.description}\n\n`;
            message += `🎭 *Géneros:* ${movie.genres.join(', ')}\n`;
            message += `📅 *Año:* ${movie.releaseYear}\n`;
            message += `🎥 *Calidad:* ${movie.quality}\n`;
            if (movie.isNewRelease) {
                message += `⭐ *ESTRENO*\n`;
            }
            message += `👁️ *Vistas:* ${movie.views || 0}\n`;
            if (movie.trailer) {
                message += `\n🎬 *Trailer:* ${movie.trailer}`;
            }

            // Codificar el mensaje para URL
            const encodedMessage = encodeURIComponent(message);
            
            // Crear el enlace de WhatsApp
            const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
            
            // Abrir WhatsApp en una nueva ventana
            window.open(whatsappUrl, '_blank');
        };

        request.onerror = () => {
            console.error('Error al obtener la información de la película');
            alert('Error al preparar la información para compartir');
        };
    } catch (error) {
        console.error('Error al compartir la película:', error);
        alert('Error al compartir la película');
    }
}

// Generate HTML Catalog
generateHtmlCatalog.addEventListener('click', async () => {
    try {
        const transaction = db.transaction(['movies'], 'readonly');
        const store = transaction.objectStore('movies');
        const request = store.getAll();

        request.onsuccess = () => {
            const movies = request.result;
            if (!movies || movies.length === 0) {
                alert('No hay películas para generar el catálogo');
                return;
            }

            // Aplicar los mismos filtros que están activos en la interfaz
            const searchTerm = searchInput.value.toLowerCase();
            const selectedGenre = genreFilter.value;
            const selectedQuality = qualityFilter.value;
            const selectedYear = yearFilter.value;
            const selectedRelease = releaseFilter.value;
            const selectedViews = viewsFilter.value;

            let filteredMovies = movies.filter(movie => {
                const matchesSearch = movie.name.toLowerCase().includes(searchTerm);
                const matchesGenre = !selectedGenre || (movie.genres && movie.genres.includes(selectedGenre));
                const matchesQuality = !selectedQuality || movie.quality === selectedQuality;
                const matchesYear = !selectedYear || movie.releaseYear === selectedYear;
                const matchesRelease = !selectedRelease || movie.isNewRelease === (selectedRelease === 'true');
                return matchesSearch && matchesGenre && matchesQuality && matchesYear && matchesRelease;
            });

            if (selectedViews) {
                filteredMovies.sort((a, b) => {
                    const viewsA = a.views || 0;
                    const viewsB = b.views || 0;
                    return selectedViews === 'most' ? viewsB - viewsA : viewsA - viewsB;
                });
            }

            // Generar el HTML del catálogo
            const catalogHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Catálogo de Películas</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #1a1a1a;
            color: #ffffff;
        }
        .catalog-template {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .catalog-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .catalog-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .movie-card {
            background-color: #2a2a2a;
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.3s ease;
        }
        .movie-card:hover {
            transform: scale(1.02);
        }
        .movie-poster {
            width: 100%;
            aspect-ratio: 2/3;
            object-fit: cover;
        }
        .movie-info {
            padding: 15px;
        }
        .movie-title {
            font-size: 1.2em;
            margin-bottom: 10px;
            color: #e50914;
        }
        .movie-description {
            font-size: 0.9em;
            color: #ddd;
            margin-bottom: 15px;
        }
        .movie-meta {
            font-size: 0.8em;
            color: #aaa;
        }
        .movie-trailer {
            margin-top: 15px;
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
        }
        .movie-trailer iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        @media (max-width: 768px) {
            .catalog-grid {
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="catalog-template">
        <div class="catalog-header">
            <h1>Catálogo de Películas</h1>
            <p>Total de películas: ${filteredMovies.length}</p>
        </div>
        <div class="catalog-grid">
            ${filteredMovies.map(movie => `
                <div class="movie-card">
                    <img src="${movie.coverImage || ''}" alt="${movie.name}" class="movie-poster">
                    <div class="movie-info">
                        <h2 class="movie-title">${movie.name}</h2>
                        <p class="movie-description">${movie.description}</p>
                        <div class="movie-meta">
                            <p>🎭 Géneros: ${movie.genres.join(', ')}</p>
                            <p>📅 Año: ${movie.releaseYear}</p>
                            <p>🎥 Calidad: ${movie.quality}</p>
                            ${movie.isNewRelease ? '<p>⭐ ESTRENO</p>' : ''}
                            <p>👁️ Vistas: ${movie.views || 0}</p>
                        </div>
                        ${movie.trailer ? `
                            <div class="movie-trailer">
                                <iframe 
                                    src="https://www.youtube.com/embed/${getVideoId(movie.trailer)}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

            // Crear y descargar el archivo
            const blob = new Blob([catalogHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'catalogo_peliculas.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        request.onerror = () => {
            console.error('Error al generar el catálogo HTML');
            alert('Error al generar el catálogo HTML');
        };
    } catch (error) {
        console.error('Error al generar el catálogo:', error);
        alert('Error al generar el catálogo');
    }
}); 