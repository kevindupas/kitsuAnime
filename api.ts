// Service API pour récupérer les données d'anime depuis l'API Kitsu
// URL de base de l'API Kitsu - toutes nos requêtes commenceront par cette URL
const BASE_URL = 'https://kitsu.io/api/edge';

// ============================================================================
// DÉFINITION DES TYPES TYPESCRIPT
// ============================================================================

// Interface pour représenter les différentes tailles d'images disponibles
// Le "?" signifie que la propriété est optionnelle (peut être undefined)
export interface KitsuImage {
    tiny?: string;      // Image très petite (vignette)
    small?: string;     // Petite image
    medium?: string;    // Image moyenne (taille par défaut)
    large?: string;     // Grande image
    original?: string;  // Image originale (plus haute qualité)
}

// Interface principale contenant toutes les informations d'un anime
// Cette interface définit la structure des données que nous recevrons de l'API
export interface KitsuAttributes {
    createdAt: string;              // Date de création dans la base de données
    updatedAt: string;              // Date de dernière mise à jour
    slug: string;                   // Identifiant unique pour l'URL (ex: "attack-on-titan")
    synopsis: string;               // Résumé court de l'anime
    description: string;            // Description détaillée
    coverImageTopOffset: number;    // Décalage pour l'image de couverture

    // Objet contenant les titres dans différentes langues
    titles: {
        en?: string;        // Titre en anglais
        en_jp?: string;     // Titre romanisé depuis le japonais
        ja_jp?: string;     // Titre en japonais (caractères japonais)
    };

    canonicalTitle: string;         // Titre principal/officiel
    abbreviatedTitles: string[];    // Liste des titres abrégés (ex: ["AOT"] pour Attack on Titan)
    averageRating: string;          // Note moyenne (sur 100) sous forme de string
    ratingFrequencies: Record<string, string>; // Répartition des notes (combien de personnes ont donné chaque note)
    userCount: number;              // Nombre d'utilisateurs qui ont ajouté cet anime
    favoritesCount: number;         // Nombre de fois ajouté aux favoris
    startDate: string;              // Date de début de diffusion (format ISO)
    endDate: string;                // Date de fin de diffusion
    nextRelease: string | null;     // Date du prochain épisode (null si terminé)
    popularityRank: number;         // Classement par popularité
    ratingRank: number;             // Classement par note
    ageRating: string;              // Classification d'âge (ex: "PG", "R")
    ageRatingGuide: string;         // Explication de la classification
    subtype: string;                // Type d'anime (TV, Movie, OVA, etc.)
    status: string;                 // Statut (current, upcoming, finished)
    tba: string | null;             // "To Be Announced" - informations non annoncées
    posterImage: KitsuImage;        // Image de poster (affiche)
    coverImage: KitsuImage;         // Image de couverture (bannière)
    episodeCount: number;           // Nombre total d'épisodes
    episodeLength: number;          // Durée d'un épisode en minutes
    totalLength: number;            // Durée totale en minutes
    youtubeVideoId: string;         // ID de la vidéo YouTube (trailer)
    showType: string;               // Type de série
    nsfw: boolean;                  // "Not Safe For Work" - contenu pour adultes
}

// Interface pour les informations spécifiques à un épisode
export interface KitsuEpisodeAttributes {
    createdAt: string;
    updatedAt: string;

    // Titres de l'épisode dans différentes langues
    titles: {
        en_jp?: string;     // Titre romanisé
        ja_jp?: string;     // Titre japonais
        en_us?: string;     // Titre anglais américain
    };

    canonicalTitle: string;     // Titre principal de l'épisode
    seasonNumber: number;       // Numéro de saison
    number: number;             // Numéro de l'épisode dans la série complète
    relativeNumber: number;     // Numéro de l'épisode dans la saison
    synopsis: string;           // Résumé de l'épisode
    airdate: string;           // Date de diffusion
    length: number;            // Durée en minutes
    thumbnail: KitsuImage;     // Image miniature de l'épisode
}

// Interface représentant un anime complet avec ses métadonnées
// Cette structure suit le format JSON:API utilisé par Kitsu
export interface KitsuAnime {
    id: string;                 // Identifiant unique
    type: string;               // Type de ressource (toujours "anime")
    links: {                    // Liens vers les ressources API
        self: string;           // Lien vers cette ressource
    };
    attributes: KitsuAttributes; // Toutes les données de l'anime
    relationships?: {           // Relations vers d'autres ressources (optionnel)
        episodes?: {
            links: {
                self: string;
                related: string;
            }
        },
        categories?: {          // Genres/catégories de l'anime
            links: {
                self: string;
                related: string;
            }
        }
    };
}

// Interface pour représenter un épisode
export interface KitsuEpisode {
    id: string;
    type: string;
    links: {
        self: string;
    };
    attributes: KitsuEpisodeAttributes;
    relationships: {
        media: {                // Référence vers l'anime parent
            links: {
                self: string;
                related: string;
            },
            data: {
                type: string;   // Type de média (anime)
                id: string;     // ID de l'anime parent
            }
        }
    };
}

// Interface générique pour les réponses qui contiennent une liste d'éléments
// Le "T" est un type générique - ça peut être KitsuAnime, KitsuEpisode, etc.
export interface KitsuListResponse<T> {
    data: T[];                  // Tableau des résultats
    meta: {                     // Métadonnées sur la réponse
        count: number;          // Nombre total de résultats disponibles
    };
    links: {                    // Liens pour la pagination
        first: string;          // Premier page
        next?: string;          // Page suivante (optionnel)
        last: string;           // Dernière page
    };
}

// Interface pour les réponses qui contiennent un seul élément
export interface KitsuSingleResponse<T> {
    data: T;                    // Un seul résultat (pas un tableau)
}

// Interface pour représenter une catégorie/genre d'anime
export interface KitsuCategory {
    id: string;
    type: string;
    attributes: {
        createdAt: string;
        updatedAt: string;
        title: string;          // Nom de la catégorie (ex: "Action", "Romance")
        description: string;    // Description de la catégorie
        slug: string;           // Version URL-friendly du titre
        nsfw: boolean;          // Si la catégorie contient du contenu adulte
        childCount: number;     // Nombre de sous-catégories
    };
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

// Fonction pour obtenir l'URL d'une image avec système de fallback
// Si la taille demandée n'existe pas, on essaie les autres tailles
export const getImageUrl = (
    imageObj?: KitsuImage,  // Objet image (peut être undefined)
    size: 'tiny' | 'small' | 'medium' | 'large' | 'original' = 'medium'  // Taille désirée avec valeur par défaut
): string => {
    // Si aucune image n'est fournie, on retourne un placeholder
    if (!imageObj) {
        return 'https://via.placeholder.com/225x350?text=No+Image';
    }

    // On essaie d'abord la taille demandée, puis medium, puis original
    // L'opérateur || signifie "OU" - on prend la première valeur qui n'est pas null/undefined
    return imageObj[size] || imageObj.medium || imageObj.original || 'https://via.placeholder.com/225x350?text=No+Image';
};

// Fonction pour obtenir le meilleur titre disponible selon un ordre de priorité
export const getBestTitle = (
    titles?: {
        en?: string;
        en_jp?: string;
        en_us?: string;
        ja_jp?: string;
    },
    canonicalTitle?: string
): string => {
    // Si on n'a ni titres ni titre canonique, on retourne un titre par défaut
    if (!titles && !canonicalTitle) return 'Unknown Title';

    // Le titre canonique a la priorité
    if (canonicalTitle) return canonicalTitle;

    // Sinon on cherche dans l'ordre de préférence : anglais > anglais US > romanisé > japonais
    return titles?.en || titles?.en_us || titles?.en_jp || titles?.ja_jp || 'Unknown Title';
};

// Fonction utilitaire pour ajouter un délai (prévenir le rate limiting)
// Promise = promesse en JavaScript - permet d'attendre qu'une action se termine
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// FONCTIONS D'APPEL À L'API
// ============================================================================

// Récupère les animes actuellement en cours de diffusion
// async/await permet d'écrire du code asynchrone de manière synchrone
export const fetchCurrentlyAiringAnime = async (): Promise<KitsuAnime[]> => {
    try {
        // Construction de l'URL avec les paramètres de requête
        // filter[status]=current : seulement les animes en cours
        // sort=-startDate : trier par date de début décroissante (plus récents d'abord)
        // page[limit]=20 : limiter à 20 résultats
        // include=categories : inclure les données des catégories
        const response = await fetch(
            `${BASE_URL}/anime?filter[status]=current&sort=-startDate&page[limit]=20&include=categories`
        );

        // Vérifier si la requête a réussi (status 200-299)
        if (!response.ok) {
            console.error(`Erreur API: ${response.status} ${response.statusText}`);
            throw new Error('Échec de récupération des animes actuels');
        }

        // Convertir la réponse JSON en objet JavaScript
        // On spécifie le type attendu pour avoir l'autocomplétion
        const data: KitsuListResponse<KitsuAnime> = await response.json();

        // Retourner seulement le tableau des animes (sans les métadonnées)
        return data.data;
    } catch (error) {
        // En cas d'erreur, on la log et on retourne un tableau vide
        // Cela évite de faire planter l'application
        console.error('Erreur lors de la récupération des animes actuels:', error);
        return [];
    }
};

// Récupère les animes qui vont sortir prochainement
export const fetchUpcomingAnime = async (): Promise<KitsuAnime[]> => {
    try {
        // filter[status]=upcoming : seulement les animes à venir
        // sort=startDate : trier par date de début croissante (prochains d'abord)
        const response = await fetch(
            `${BASE_URL}/anime?filter[status]=upcoming&sort=startDate&page[limit]=20&include=categories`
        );

        if (!response.ok) {
            console.error(`Erreur API: ${response.status} ${response.statusText}`);
            throw new Error('Échec de récupération des animes à venir');
        }

        const data: KitsuListResponse<KitsuAnime> = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erreur lors de la récupération des animes à venir:', error);
        return [];
    }
};

// Recherche des animes par titre
export const searchAnime = async (query: string): Promise<KitsuAnime[]> => {
    try {
        // Vérifier que la requête n'est pas vide après suppression des espaces
        if (!query.trim()) return [];

        // encodeURIComponent encode les caractères spéciaux pour l'URL
        // Par exemple, "Attack on Titan" devient "Attack%20on%20Titan"
        const response = await fetch(
            `${BASE_URL}/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=20`
        );

        if (!response.ok) {
            console.error(`Erreur API: ${response.status} ${response.statusText}`);
            throw new Error('Échec de la recherche d\'anime');
        }

        const data: KitsuListResponse<KitsuAnime> = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erreur lors de la recherche d\'anime:', error);
        return [];
    }
};

// Récupère les détails complets d'un anime par son ID
export const fetchAnimeById = async (id: string): Promise<KitsuAnime | null> => {
    try {
        // Requête simple vers un anime spécifique
        const response = await fetch(`${BASE_URL}/anime/${id}`);

        if (!response.ok) {
            throw new Error(`Échec de récupération des détails de l'anime pour l'ID: ${id}`);
        }

        // Cette fois on attend une réponse avec un seul élément (pas un tableau)
        const data: KitsuSingleResponse<KitsuAnime> = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des détails de l'anime pour l'ID ${id}:`, error);
        // On retourne null pour indiquer qu'aucun anime n'a été trouvé
        return null;
    }
};

// Récupère les détails d'un épisode par son ID
export const fetchEpisodeById = async (id: string): Promise<KitsuEpisode | null> => {
    try {
        // include=media permet d'avoir les informations de l'anime parent
        const response = await fetch(`${BASE_URL}/episodes/${id}?include=media`);

        if (!response.ok) {
            throw new Error(`Échec de récupération des détails de l'épisode pour l'ID: ${id}`);
        }

        const data: KitsuSingleResponse<KitsuEpisode> = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des détails de l'épisode pour l'ID ${id}:`, error);
        return null;
    }
};

// Récupère tous les épisodes d'un anime donné
export const fetchEpisodesByAnimeId = async (animeId: string): Promise<KitsuEpisode[]> => {
    try {
        // sort=number : trier par numéro d'épisode croissant
        const response = await fetch(
            `${BASE_URL}/anime/${animeId}/episodes?sort=number&page[limit]=20`
        );

        if (!response.ok) {
            throw new Error(`Échec de récupération des épisodes pour l'anime ID: ${animeId}`);
        }

        const data: KitsuListResponse<KitsuEpisode> = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des épisodes pour l'anime ID ${animeId}:`, error);
        return [];
    }
};

// Récupère les catégories/genres d'un anime spécifique
export const fetchAnimeCategories = async (animeId: string): Promise<KitsuCategory[]> => {
    try {
        const response = await fetch(
            `${BASE_URL}/anime/${animeId}/categories`
        );

        if (!response.ok) {
            throw new Error(`Échec de récupération des catégories pour l'anime ID: ${animeId}`);
        }

        const data: KitsuListResponse<KitsuCategory> = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des catégories pour l'anime ID ${animeId}:`, error);
        return [];
    }
};

// Récupère toutes les catégories disponibles sur Kitsu
export const fetchAllCategories = async (): Promise<KitsuCategory[]> => {
    try {
        // Les catégories sont paginées, on récupère les 40 premières triées alphabétiquement
        const response = await fetch(
            `${BASE_URL}/categories?page[limit]=40&sort=title`
        );

        if (!response.ok) {
            console.error(`Erreur API: ${response.status} ${response.statusText}`);
            throw new Error('Échec de récupération des catégories');
        }

        const data: KitsuListResponse<KitsuCategory> = await response.json();
        return data.data;
    } catch (error) {
        console.error('Erreur lors de la récupération des catégories:', error);
        return [];
    }
};

// Recherche des animes appartenant à une catégorie spécifique
export const searchAnimeByCategory = async (categoryId: string): Promise<KitsuAnime[]> => {
    try {
        const response = await fetch(
            `${BASE_URL}/categories/${categoryId}/anime?page[limit]=20`
        );

        if (!response.ok) {
            console.error(`Erreur API: ${response.status} ${response.statusText}`);
            throw new Error(`Échec de récupération des animes pour la catégorie ID: ${categoryId}`);
        }

        const data: KitsuListResponse<KitsuAnime> = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des animes pour la catégorie ID ${categoryId}:`, error);
        return [];
    }
};

// ============================================================================
// EXEMPLES D'UTILISATION
// ============================================================================

/*
EXEMPLE 1 : Récupérer et afficher les animes actuels
-----------
async function exempleAnimesActuels() {
    const animes = await fetchCurrentlyAiringAnime();
    
    animes.forEach(anime => {
        console.log(`Titre: ${getBestTitle(anime.attributes.titles, anime.attributes.canonicalTitle)}`);
        console.log(`Note: ${anime.attributes.averageRating}/100`);
        console.log(`Épisodes: ${anime.attributes.episodeCount}`);
        console.log(`Image: ${getImageUrl(anime.attributes.posterImage, 'medium')}`);
        console.log('---');
    });
}

EXEMPLE 2 : Rechercher un anime spécifique
-----------
async function exempleRecherche() {
    const resultats = await searchAnime('One Piece');
    
    if (resultats.length > 0) {
        const anime = resultats[0]; // Premier résultat
        console.log(`Trouvé: ${anime.attributes.canonicalTitle}`);
        
        // Récupérer les détails complets
        const details = await fetchAnimeById(anime.id);
        if (details) {
            console.log(`Synopsis: ${details.attributes.synopsis}`);
        }
        
        // Récupérer les genres
        const categories = await fetchAnimeCategories(anime.id);
        console.log(`Genres: ${categories.map(c => c.attributes.title).join(', ')}`);
    }
}

EXEMPLE 3 : Gestion des erreurs
-----------
async function exempleGestionErreurs() {
    try {
        const anime = await fetchAnimeById('id-inexistant');
        
        if (anime) {
            console.log('Anime trouvé:', anime.attributes.canonicalTitle);
        } else {
            console.log('Aucun anime trouvé avec cet ID');
        }
    } catch (error) {
        console.error('Une erreur est survenue:', error.message);
    }
}
*/