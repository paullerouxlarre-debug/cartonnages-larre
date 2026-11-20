# La fabrique d’une boîte · Cartonnages Larré

Une visite interactive de 44 secondes suit le même étui, de la pile de carton à son ouverture chez le client. [Voir le site sur GitHub Pages](https://paullerouxlarre-debug.github.io/cartonnages-larre/)

## Visiter l’atelier

« Lancer le film » déroule la fabrication en continu. Le défilement, les cinq chapitres et le curseur permettent aussi de s’arrêter sur un geste. Au clavier, les flèches déplacent le curseur d’une seconde et la touche Fin rejoint la boîte montée. « Tourner l’étui » ouvre alors le modèle 3D.

Les cadrages large et portrait disposent chacun de leur propre film. Avec la préférence de mouvement réduit, le visiteur découvre d’abord les plans fixes et peut lancer la lecture. La version texte décrit les opérations dans leur ordre de fabrication.

## Images et procédés

L’album reprend les vues publiées par l’entreprise à Bayonne. La presse est présentée dans une vue technique. Les autres images montrent le hall, la table du bureau d’études, l’autoplatine et les courroies de la plieuse-colleuse. [Accueil de Cartonnages Larré](https://www.cartonnages-larre.fr/fr/) · [Procédés et vues des machines](https://www.cartonnages-larre.fr/fr/process.html)

Le film est une reconstitution pédagogique en 3D. Le décor imprimé de l’étui, les coupes des machines et la scène de réception ont été créés pour la visite.

## Fichiers du site

Le dépôt se sert comme un site statique, à sa racine ou dans un sous-dossier. La branche `main` alimente GitHub Pages.

- `index.html` contient le parcours, sa transcription et les coordonnées.
- `assets/film/` réunit les deux films et leurs photogrammes. `assets/images/` contient les vues de l’entreprise.
- `js/visite.js` synchronise la lecture, le défilement, les légendes et les commandes.
- `js/scene.js`, `js/atelier.js`, `js/etui.js` et `js/matiere.js` décrivent le modèle et ses mouvements.
- Les polices et Three.js sont hébergés dans le dépôt avec leurs licences.
