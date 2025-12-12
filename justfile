serve:
    (sleep 1 && open "http://localhost:8000/example.html") &
    python3 -m http.server

test:
    node --test
