import 'package:flutter_test/flutter_test.dart';
import 'package:digital_topup_mobile/api_client.dart';

void main() {
  group('API response helpers', () {
    test('rows returns list of map objects', () {
      final result = rows([
        {'id': 'one'},
        {'id': 'two'},
      ]);
      expect(result, hasLength(2));
      expect(result.first['id'], 'one');
    });

    test('rows unwraps common paginated response keys', () {
      expect(rows({'data': [{'id': 'x'}]}).single['id'], 'x');
      expect(rows({'items': [{'id': 'y'}]}).single['id'], 'y');
      expect(rows({'orders': [{'id': 'z'}]}).single['id'], 'z');
    });

    test('rows safely handles unexpected response types', () {
      expect(rows(null), isEmpty);
      expect(rows({'message': 'empty'}), isEmpty);
    });

    test('money formats a numeric amount without currency conversion', () {
      expect(money(12.5, 'YER'), '12.50 YER');
      expect(money('8', 'USD'), '8.00 USD');
      expect(money(null, 'SAR'), '— SAR');
    });
  });
}
