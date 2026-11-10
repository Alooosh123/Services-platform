import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
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

  test('wallet history uses authenticated customer API and pagination filters', () async {
    late MockClient mockClient;
    mockClient = MockClient((request) async {
      expect(request.method, 'GET');
      expect(request.url.host, 'api.example.test');
      expect(request.url.path, '/api/wallet/transactions');
      expect(request.url.queryParameters['currency'], 'YER');
      expect(request.url.queryParameters['page'], '2');
      expect(request.url.queryParameters['limit'], '10');
      expect(request.headers['Authorization'], 'Bearer test-access-token');

      return http.Response(
        jsonEncode({
          'items': [
            {
              'id': 'entry-1',
              'direction': 'CREDIT',
              'amount': 5000,
              'balanceBefore': 0,
              'balanceAfter': 5000,
              'currency': 'YER',
              'referenceType': 'DEPOSIT',
              'referenceId': 'DEP-1',
              'description': 'Verified deposit',
              'createdAt': '2026-11-10T08:00:00.000Z',
            },
          ],
          'page': 2,
          'limit': 10,
          'total': 11,
          'pages': 2,
        }),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    });
    addTearDown(mockClient.close);

    final api = ApiClient.withClient(
      httpClient: mockClient,
      baseUrl: 'https://api.example.test/api',
    );
    api.accessToken = 'test-access-token';

    final result = await api.getWalletTransactions(currency: 'YER', page: 2, limit: 10);

    expect(result, isA<Map>());
    expect((result as Map)['items'], isA<List>());
    expect((result['items'] as List).single['balanceAfter'], 5000);
    expect(result['total'], 11);
  });
}
