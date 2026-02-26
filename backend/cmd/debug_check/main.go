package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbUrl := "postgres://siap_admin:siap_password@localhost:5432/siap_bpk?sslmode=disable"
	conn, err := pgx.Connect(context.Background(), dbUrl)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(context.Background())

	var count int
	err = conn.QueryRow(context.Background(), "SELECT count(*) FROM anggaran_program WHERE tahun_anggaran = 2026").Scan(&count)
	if err != nil {
		fmt.Printf("Query failed for 2026 check: %v\n", err)
	} else {
		fmt.Printf("Count of anggaran_program for 2026: %d\n", count)
	}

	var programID string
	err = conn.QueryRow(context.Background(), "SELECT id::text FROM anggaran_program WHERE tahun_anggaran = 2026 LIMIT 1").Scan(&programID)
	if err != nil {
		fmt.Printf("Get Program ID failed: %v\n", err)
	} else {
		fmt.Printf("Program ID for 2026: %s\n", programID)

		var kegiatanCount int
		err = conn.QueryRow(context.Background(), "SELECT count(*) FROM anggaran_kegiatan WHERE program_id = $1", programID).Scan(&kegiatanCount)
		fmt.Printf("Kegiatan count: %d\n", kegiatanCount)

		if kegiatanCount > 0 {
			var outputCount int
			err = conn.QueryRow(context.Background(),
				"SELECT count(*) FROM anggaran_output join anggaran_kegiatan on anggaran_output.kegiatan_id = anggaran_kegiatan.id WHERE program_id = $1", programID).Scan(&outputCount)
			fmt.Printf("Output waiting count (via join): %d\n", outputCount)
		}
	}

	var fullTreeCount int
	query := `SELECT count(*)
	FROM anggaran_program sp
	JOIN anggaran_kegiatan sk ON sk.program_id = sp.id
	JOIN anggaran_output so ON so.kegiatan_id = sk.id
	JOIN anggaran_sub_output ss ON ss.output_id = so.id
	JOIN anggaran_akun sa ON sa.sub_output_id = ss.id
	WHERE sp.tahun_anggaran = 2026`

	err = conn.QueryRow(context.Background(), query).Scan(&fullTreeCount)
	if err != nil {
		fmt.Printf("Full tree query failed: %v\n", err)
	} else {
		fmt.Printf("Full tree count: %d\n", fullTreeCount)
	}
}
