# Workflow Git pour le Comparateur Multi-Véhicules

## Configuration actuelle

- **Branche principale (stable)** : `main`
- **Branche de développement** : `develop` 
- **Tag de version actuelle** : `v1.0.0-current`
- **Dépôt GitHub** : https://github.com/simclem77/projetVoiture

## Commandes essentielles

### Switcher entre les versions

```bash
# Aller sur la version stable (main)
git checkout main

# Aller sur la version de développement
git checkout develop

# Revenir à la version taggée v1.0.0-current
git checkout v1.0.0-current
```

### Travailler sur les nouvelles fonctionnalités

1. **Assurez-vous d'être sur la branche develop** :
```bash
git checkout develop
```

2. **Faites vos modifications et committez** :
```bash
git add .
git commit -m "feat: description de la fonctionnalité"
git push origin develop
```

3. **Pour fusionner dans main quand c'est stable** :
```bash
git checkout main
git merge develop
git tag v1.1.0  # Créer un nouveau tag
git push origin main v1.1.0
```

### Vérifier l'état actuel

```bash
# Voir les branches disponibles
git branch -a

# Voir les tags
git tag

# Voir l'historique des commits
git log --oneline -10

# Voir l'état du working directory
git status
```

## Workflow recommandé

### Pour le développement quotidien :
1. Travaillez toujours sur `develop`
2. Committez régulièrement
3. Poussez sur `origin/develop`

### Pour créer une nouvelle version stable :
1. Assurez-vous que `develop` est stable
2. Fusionnez `develop` dans `main`
3. Créez un nouveau tag (ex: `v1.1.0`)
4. Poussez `main` et le tag

### Pour revenir à une ancienne version :
```bash
# Voir tous les tags disponibles
git tag

# Revenir à un tag spécifique
git checkout v1.0.0-current

# Créer une branche à partir d'un tag si besoin
git checkout -b fix-bug-v1.0 v1.0.0-current
```

## Avantages de ce système

✅ **Sécurité** : `main` reste toujours une version stable  
✅ **Flexibilité** : Vous pouvez switcher instantanément entre versions  
✅ **Historique** : Tags et branches préservent l'historique complet  
✅ **Collaboration** : Idéal pour travailler en équipe  
✅ **GitHub Integration** : Pull Requests, Issues, Releases, etc.

## Liens utiles

- **Dépôt GitHub** : https://github.com/simclem77/projetVoiture
- **Branche develop** : https://github.com/simclem77/projetVoiture/tree/develop
- **Tag v1.0.0-current** : https://github.com/simclem77/projetVoiture/releases/tag/v1.0.0-current
- **Créer une Pull Request** : https://github.com/simclem77/projetVoiture/compare/develop

## Bonnes pratiques

1. **Messages de commit clairs** : Utilisez le format conventionnel (feat:, fix:, chore:, etc.)
2. **Commits fréquents** : Mieux vaut plusieurs petits commits qu'un gros
3. **Pull Requests** : Utilisez les PR pour revoir le code avant de fusionner dans main
4. **Tests** : Assurez-vous que tout fonctionne avant de fusionner
5. **Documentation** : Mettez à jour la documentation quand vous ajoutez des fonctionnalités

## En cas de problème

```bash
# Annuler les modifications non commitées
git checkout -- .

# Revenir au dernier commit (perd les modifications non commitées)
git reset --hard HEAD

# Revenir à un commit spécifique
git reset --hard <commit-hash>

# Forcer le push si nécessaire (attention !)
git push -f origin develop
```

---

**État actuel** : Vous êtes sur la branche `develop`, prêt à commencer les nouveaux développements !