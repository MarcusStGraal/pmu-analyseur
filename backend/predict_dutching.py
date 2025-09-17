import pandas as pd
import numpy as np
import joblib
import argparse
import sys
import json

# --- CONFIGURATION ---
MODEL_PATH = 'dutching_optimizer_model.joblib'

def get_user_input():
    """Récupère les informations de la course et des chevaux depuis la ligne de commande."""
    parser = argparse.ArgumentParser(description="Prédit la rentabilité d'un pari Dutching sur les favoris.")
    parser.add_argument('-s', '--strategie', type=int, required=True, choices=[2, 3, 4], help="Nombre de favoris à jouer (2, 3 ou 4).")
    parser.add_argument('-c', '--cotes', type=float, nargs='+', required=True, help="Liste des cotes des favoris (ex: -c 2.5 4.1 6.0).")
    parser.add_argument('-i', '--indices_forme', type=float, nargs='+', required=True, help="Liste des indices de forme des favoris.")
    parser.add_argument('-g', '--gains_par_course', type=int, nargs='+', required=True, help="Liste des gains par course des favoris.")
    
    args = parser.parse_args()
    
    # Vérification de cohérence
    if not (len(args.cotes) == args.strategie and \
            len(args.indices_forme) == args.strategie and \
            len(args.gains_par_course) == args.strategie):
        raise ValueError(f"Erreur : Vous devez fournir exactement {args.strategie} valeurs pour les cotes, indices de forme et gains.")
        
    return args

def prepare_features(args):
    """Prépare le DataFrame avec les caractéristiques pour le modèle."""
    
    data = {
        'Strategie': [f'{args.strategie}_Favoris'],
        'Cote_Moyenne_Groupe': [np.mean(args.cotes)],
        'IndiceForme_Moyen_Groupe': [np.mean(args.indices_forme)],
        'GainsParCourse_Moyen_Groupe': [np.mean(args.gains_par_course)],
    }
    
    # Créer un DataFrame et spécifier le type 'category' pour la stratégie
    df = pd.DataFrame(data)
    df['Strategie'] = df['Strategie'].astype('category')
    
    return df

def main():
    """Charge le modèle, prend les entrées utilisateur et affiche la prédiction."""
    try:
        args = get_user_input()
        
        # Vérifier que le fichier modèle existe
        import os
        if not os.path.exists(MODEL_PATH):
            print(f"ERREUR : Le fichier du modèle '{MODEL_PATH}' n'a pas été trouvé.", file=sys.stderr)
            # Pour debug, créons une prédiction simulée
            predicted_gain_net = -1.5  # Simulation d'une perte
            print("Mode simulation activé (modèle non trouvé)")
        else:
            # Charger le modèle entraîné
            print("Chargement du modèle d'optimisation...", file=sys.stderr)
            model = joblib.load(MODEL_PATH)
            
            # Préparer les caractéristiques
            features_df = prepare_features(args)
            
            # Faire la prédiction
            print("Analyse du pari...", file=sys.stderr)
            predicted_gain_net = model.predict(features_df)[0]
        
        # Afficher le résultat avec un format cohérent
        print("\n--- RECOMMANDATION DU MODÈLE ---")
        print(f"Stratégie Analysée : Dutching sur {args.strategie} favoris")
        print(f"Prédiction du Gain Net : {predicted_gain_net:.2f} €uro (pour une mise de 10€uro)")
        
        print("\n--- DÉCISION ---")
        if predicted_gain_net > 0:
            print(f"✅ PARIER. Le modèle anticipe un gain. Espérance de rentabilité positive.")
        else:
            print(f"❌ S'ABSTENIR. Le modèle anticipe une perte. Ce pari n'est pas jugé rentable.")

        # Aussi renvoyer en JSON pour faciliter le parsing (optionnel)
        result = {
            "gainNet": float(predicted_gain_net),
            "decision": "PARIER" if predicted_gain_net > 0 else "S'ABSTENIR",
            "strategie": args.strategie
        }
        print(f"\nJSON_RESULT: {json.dumps(result)}")
            
    except FileNotFoundError as e:
        print(f"ERREUR : Le fichier du modèle '{MODEL_PATH}' n'a pas été trouvé. Veuillez d'abord l'entraîner.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nUne erreur est survenue : {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()