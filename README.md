# La fabrique d’une boîte · Cartonnages Larré

Une visite interactive de 52 secondes suit un étui depuis la palette de feuilles vierges. La presse reçoit les feuilles imprimées sur une nouvelle palette. L’autoplatine en sépare quatre piles de poses, puis la plieuse-colleuse travaille les étuis un par un. [Voir le site sur GitHub Pages](https://paullerouxlarre-debug.github.io/cartonnages-larre/)

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

## Références du film

La disposition des piles au margeur et en réception s’appuie sur les démonstrations filmées de Komori. [Alimentation des feuilles](https://www.komorisolutions.com/video/en/v/002.html) · [Réception des feuilles](https://www.komorisolutions.com/video/en/v/021.html)

Les plans de séparation des poses et de rabattement d’un étui à patte droite ont été réglés à partir des films BOBST. [NOVACUT 106 ER, sortie des poses](https://www.youtube.com/watch?v=w7dzp3mnSg0&t=84s) · [EXPERTFOLD, pliage](https://www.youtube.com/watch?v=Jwix1kCG9Es&t=35s)

Les trois ateliers sont des reconstitutions indépendantes. La lumière du hall, le grain du bois et la texture du sol proviennent de ressources CC0 de Poly Haven. [Machine Shop 01, Sergej Majboroda](https://polyhaven.com/a/machine_shop_01) · [Wood Planks Grey, Rob Tuytel](https://polyhaven.com/a/wood_planks_grey) · [Concrete Floor 02, Rob Tuytel](https://polyhaven.com/a/concrete_floor_02)

Pour régénérer les vidéos depuis le site servi en HTTP, utiliser Node avec Playwright et FFmpeg, puis lancer chacune des deux commandes. La variable facultative CHROME_BIN permet de choisir Chromium ou Chrome.

```sh
node outils/rendre-film.cjs http://localhost:8080/ assets/film
node outils/rendre-film.cjs http://localhost:8080/ assets/film --portrait
```
