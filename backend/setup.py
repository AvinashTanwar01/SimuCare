import joblib


def main():
    feature_columns = joblib.load("models/feature_columns.pkl")
    print(f"Loaded {len(feature_columns)} feature columns:\n")
    for index, column in enumerate(feature_columns):
        print(f"{index:03d}: {column}")


if __name__ == "__main__":
    main()
