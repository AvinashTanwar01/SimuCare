function tsToDate(ts) {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString();
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleString();
  return "-";
}

export default function HistoryTable({ rows }) {
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>ICU Risk %</th>
            <th>Readmission %</th>
            <th>ICU LOS (hrs)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{tsToDate(row.timestamp)}</td>
              <td>{(Number(row.result?.ICU_Risk || 0) * 100).toFixed(1)}%</td>
              <td>{(Number(row.result?.Readmission_Risk || 0) * 100).toFixed(1)}%</td>
              <td>{Number(row.result?.ICU_LOS_hours || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
